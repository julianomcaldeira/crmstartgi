import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MarketData {
  totalValue12Months: number;
  totalValue24Months: number;
  totalQuantity12Months: number;
  totalQuantity24Months: number;
  competitors: Array<{
    name: string;
    cnpj: string;
    totalValue: number;
    contractCount: number;
    period: string;
  }>;
  sampleContracts: Array<{
    title: string;
    value: number;
    date: string;
    organ: string;
    link: string;
    pncpLink?: string;
  }>;
  rawData: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerms, filters } = await req.json();
    const stateFilter =
      filters?.state && filters.state !== "all" ? filters.state : "";
    const organTypeFilter =
      filters?.organType && filters.organType !== "all" ? filters.organType : "";

    if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
      return new Response(
        JSON.stringify({ error: "searchTerms é obrigatório e deve ser um array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      "Buscando dados do PNCP para:",
      searchTerms,
      "Filtros:",
      { stateFilter, organTypeFilter },
    );

    const now = new Date();
    const date24MonthsAgo = new Date(now);
    date24MonthsAgo.setMonth(date24MonthsAgo.getMonth() - 24);
    const date12MonthsAgo = new Date(now);
    date12MonthsAgo.setMonth(date12MonthsAgo.getMonth() - 12);

    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    const formatDate = (date: Date) => {
      return date.toISOString().split("T")[0].replace(/-/g, "");
    };

    // PNCP limita consultas por período (ex.: contratos: 365 dias). Fazemos chunking em janelas <=365.
    const makeDateRanges = (start: Date, end: Date, maxDays = 365) => {
      const ranges: Array<{ start: Date; end: Date }> = [];
      let curStart = new Date(start);
      const endTime = end.getTime();

      while (curStart.getTime() <= endTime) {
        const curEndTime = Math.min(
          endTime,
          curStart.getTime() + (maxDays - 1) * MS_PER_DAY,
        );
        const curEnd = new Date(curEndTime);
        ranges.push({ start: new Date(curStart), end: curEnd });
        curStart = new Date(curEndTime + MS_PER_DAY);
      }

      return ranges;
    };

    const dateRanges24m = makeDateRanges(date24MonthsAgo, now, 365);

    // Mantém no response o período completo solicitado
    const dataInicial = formatDate(date24MonthsAgo);
    const dataFinal = formatDate(now);

    const pncpHeaders = {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; EvoluaCRM/1.0)",
    };

    const fetchPncpJson = async (url: string, label: string) => {
      try {
        const res = await fetch(url, { headers: pncpHeaders });
        const text = await res.text();

        if (!res.ok) {
          console.log(`${label} HTTP ${res.status}:`, text.slice(0, 500));
          return null;
        }

        try {
          return JSON.parse(text);
        } catch (e) {
          console.log(
            `${label} JSON inválido:`,
            String(e),
            "| body:",
            text.slice(0, 500),
          );
          return null;
        }
      } catch (e) {
        console.log(`${label} Erro de fetch:`, String(e));
        return null;
      }
    };

    const matchesState = (organ: any): boolean => {
      if (!stateFilter) return true;
      const uf =
        organ?.uf || organ?.unidadeOrgao?.uf || organ?.municipio?.uf || "";
      return uf.toUpperCase() === stateFilter.toUpperCase();
    };

    const matchesOrganType = (organ: any): boolean => {
      if (!organTypeFilter) return true;
      const razaoSocial = (organ?.razaoSocial || organ?.nomeUnidade || "")
        .toLowerCase();
      const esferaId = organ?.esferaId || organ?.unidadeOrgao?.esferaId || "";

      switch (organTypeFilter) {
        case "federal":
          return (
            esferaId === "F" || razaoSocial.includes("ministério") ||
            razaoSocial.includes("federal")
          );
        case "estadual":
          return (
            esferaId === "E" || razaoSocial.includes("estado") ||
            razaoSocial.includes("estadual")
          );
        case "municipal":
          return (
            esferaId === "M" || razaoSocial.includes("município") ||
            razaoSocial.includes("prefeitura")
          );
        case "autarquia":
          return (
            razaoSocial.includes("autarquia") || razaoSocial.includes("instituto") ||
            razaoSocial.includes("inss")
          );
        case "empresa_publica":
          return (
            razaoSocial.includes("empresa") || razaoSocial.includes("correios") ||
            razaoSocial.includes("caixa")
          );
        case "fundacao":
          return razaoSocial.includes("fundação") || razaoSocial.includes("fundacao");
        default:
          return true;
      }
    };

    const aggregatedData: MarketData = {
      totalValue12Months: 0,
      totalValue24Months: 0,
      totalQuantity12Months: 0,
      totalQuantity24Months: 0,
      competitors: [],
      sampleContracts: [],
      rawData: { contratos: [], contratacoes: [] },
    };

    const competitorsMap = new Map<
      string,
      {
        name: string;
        cnpj: string;
        totalValue: number;
        contractCount: number;
        contracts12m: number;
        contracts24m: number;
      }
    >();

    const dedupeByKey = <T,>(items: T[], keyFn: (item: T) => string): T[] => {
      const seen = new Set<string>();
      const out: T[] = [];
      for (const item of items) {
        const key = keyFn(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
      return out;
    };

    const fetchWithPagination = async (
      baseUrl: string,
      label: string,
      maxPages = 3,
      pageSize = 100,
    ): Promise<any[]> => {
      const allResults: any[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore && currentPage <= maxPages) {
        const url = `${baseUrl}&pagina=${currentPage}&tamanhoPagina=${pageSize}`;
        console.log(`${label} - Página ${currentPage}:`, url);

        const data = await fetchPncpJson(url, `${label} (p${currentPage})`);

        if (!data) {
          hasMore = false;
          break;
        }

        const items = data?.data ?? data ?? [];
        const itemsArray = Array.isArray(items) ? items : [];

        if (itemsArray.length === 0) {
          hasMore = false;
        } else {
          allResults.push(...itemsArray);
          if (itemsArray.length < pageSize) hasMore = false;
          currentPage++;
        }
      }

      console.log(
        `${label} - Total coletado: ${allResults.length} registros em ${currentPage - 1} páginas`,
      );
      return allResults;
    };

    // Endpoint de contratações/publicacao exige codigoModalidadeContratacao.
    const MODALIDADES_CONTRATACAO = [6, 8, 9, 10];

    for (const term of searchTerms) {
      try {
        const encodedTerm = encodeURIComponent(term);
        const termLower = term.toLowerCase();

        // =====================
        // CONTRATOS (chunking <=365 dias)
        // =====================
        console.log("Iniciando busca de contratos para:", term);
        let contratos: any[] = [];

        for (const r of dateRanges24m) {
          const rStart = formatDate(r.start);
          const rEnd = formatDate(r.end);
          const base =
            `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${rStart}&dataFinal=${rEnd}&termo=${encodedTerm}`;
          contratos.push(
            ...await fetchWithPagination(base, `Contratos ${rStart}-${rEnd}`, 3, 100),
          );
        }

        contratos = dedupeByKey(contratos, (c: any) => c.numeroControlePNCP || "");

        // Fallback sem termo (ainda com chunking)
        if (contratos.length === 0) {
          console.log("Buscando contratos (fallback sem termo)");
          let fallbackAll: any[] = [];
          for (const r of dateRanges24m) {
            const rStart = formatDate(r.start);
            const rEnd = formatDate(r.end);
            const base =
              `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${rStart}&dataFinal=${rEnd}`;
            fallbackAll.push(
              ...await fetchWithPagination(
                base,
                `Contratos (fallback) ${rStart}-${rEnd}`,
                2,
                100,
              ),
            );
          }
          contratos = dedupeByKey(fallbackAll, (c: any) => c.numeroControlePNCP || "");
        }

        console.log("Total de contratos recebidos:", contratos.length);

        const filteredContratos = contratos.filter((c: any) => {
          const objeto = (c.objetoContrato || c.objeto || "").toLowerCase();
          const matchesTerm = objeto.includes(termLower);
          const matchesStateFilter = matchesState(c.orgaoEntidade || c.unidadeOrgao);
          const matchesOrgan = matchesOrganType(c.orgaoEntidade || c.unidadeOrgao);
          return matchesTerm && matchesStateFilter && matchesOrgan;
        });

        console.log(`Contratos filtrados para "${term}":`, filteredContratos.length);

        for (const contrato of filteredContratos) {
          const contratoDate = new Date(
            contrato.dataVigenciaInicio || contrato.dataPublicacaoPncp ||
              contrato.dataAssinatura,
          );
          const valor =
            contrato.valorInicial || contrato.valorFinal || contrato.valorTotal || 0;

          if (contratoDate >= date12MonthsAgo) {
            aggregatedData.totalValue12Months += valor;
            aggregatedData.totalQuantity12Months += 1;
          }
          if (contratoDate >= date24MonthsAgo) {
            aggregatedData.totalValue24Months += valor;
            aggregatedData.totalQuantity24Months += 1;
          }

          const fornecedorCnpj = contrato.cnpjFornecedor || contrato.fornecedor?.cnpj;
          const fornecedorNome =
            contrato.razaoSocialFornecedor || contrato.fornecedor?.razaoSocial ||
            "Não informado";

          if (fornecedorCnpj) {
            const existing = competitorsMap.get(fornecedorCnpj);
            if (existing) {
              existing.totalValue += valor;
              existing.contractCount += 1;
              if (contratoDate >= date12MonthsAgo) existing.contracts12m += 1;
              existing.contracts24m += 1;
            } else {
              competitorsMap.set(fornecedorCnpj, {
                name: fornecedorNome,
                cnpj: fornecedorCnpj,
                totalValue: valor,
                contractCount: 1,
                contracts12m: contratoDate >= date12MonthsAgo ? 1 : 0,
                contracts24m: 1,
              });
            }
          }

          if (aggregatedData.sampleContracts.length < 10) {
            const numeroControle = contrato.numeroControlePNCP || contrato.numero || "";
            const cnpjOrgao = (contrato.orgaoEntidade?.cnpj || contrato.unidadeOrgao?.cnpj || "")
              .replace(/\D/g, "");
            const anoContrato =
              contrato.anoContrato ||
              new Date(contrato.dataVigenciaInicio || contrato.dataAssinatura || "")
                .getFullYear();
            const sequencialContrato = contrato.sequencialContrato || "";

            let parsedCnpj = cnpjOrgao;
            let parsedAno = anoContrato;
            let parsedSequencial = sequencialContrato;

            if (numeroControle && numeroControle.includes("-")) {
              const match = numeroControle.match(/^(\d+)-(\d+)-(\d+)\/(\d+)$/);
              if (match) {
                parsedCnpj = match[1];
                parsedSequencial = match[3];
                parsedAno = parseInt(match[4]);
              }
            }

            let documentLink = "";
            let pncpPortalLink = "";

            if (contrato.linkSistemaOrigem && contrato.linkSistemaOrigem.startsWith("http")) {
              documentLink = contrato.linkSistemaOrigem;
            }

            if (parsedCnpj && parsedAno && parsedSequencial) {
              if (!documentLink) {
                documentLink =
                  `https://pncp.gov.br/api/pncp/v1/orgaos/${parsedCnpj}/contratos/${parsedAno}/${parsedSequencial}/arquivos/1`;
              }
              pncpPortalLink =
                `https://pncp.gov.br/app/contratos/${parsedCnpj}/2/${parsedAno}/${parsedSequencial}`;
            } else if (numeroControle) {
              pncpPortalLink = `https://pncp.gov.br/app/contratos/${numeroControle}`;
            }

            if (!documentLink) {
              documentLink = pncpPortalLink || "https://pncp.gov.br/app/contratos";
            }

            aggregatedData.sampleContracts.push({
              title: contrato.objetoContrato || contrato.objeto || "Contrato sem título",
              value: valor,
              date: contrato.dataVigenciaInicio || contrato.dataPublicacaoPncp || "",
              organ: contrato.orgaoEntidade?.razaoSocial ||
                contrato.unidadeOrgao?.nomeUnidade || "Órgão não informado",
              link: documentLink,
              pncpLink: pncpPortalLink,
            });
          }

          aggregatedData.rawData.contratos.push(contrato);
        }

        // =====================
        // CONTRATAÇÕES (publicacao) - exige modalidade + chunking
        // =====================
        console.log("Iniciando busca de contratações para:", term);
        let contratacoes: any[] = [];

        for (const r of dateRanges24m) {
          const rStart = formatDate(r.start);
          const rEnd = formatDate(r.end);

          for (const codigoModalidadeContratacao of MODALIDADES_CONTRATACAO) {
            const base =
              `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${rStart}&dataFinal=${rEnd}&termo=${encodedTerm}&codigoModalidadeContratacao=${codigoModalidadeContratacao}`;
            contratacoes.push(
              ...await fetchWithPagination(
                base,
                `Contratações M${codigoModalidadeContratacao} ${rStart}-${rEnd}`,
                2,
                100,
              ),
            );
          }
        }

        contratacoes = dedupeByKey(contratacoes, (c: any) => c.numeroControlePNCP || "");

        // Fallback sem termo (mantém modalidade)
        if (contratacoes.length === 0) {
          console.log("Buscando contratações (fallback sem termo)");
          let fallbackAll: any[] = [];

          for (const r of dateRanges24m) {
            const rStart = formatDate(r.start);
            const rEnd = formatDate(r.end);

            for (const codigoModalidadeContratacao of MODALIDADES_CONTRATACAO) {
              const base =
                `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${rStart}&dataFinal=${rEnd}&codigoModalidadeContratacao=${codigoModalidadeContratacao}`;
              fallbackAll.push(
                ...await fetchWithPagination(
                  base,
                  `Contratações (fallback) M${codigoModalidadeContratacao} ${rStart}-${rEnd}`,
                  1,
                  100,
                ),
              );
            }
          }

          contratacoes = dedupeByKey(fallbackAll, (c: any) => c.numeroControlePNCP || "");
        }

        console.log("Total de contratações recebidas:", contratacoes.length);

        const filteredContratacoes = contratacoes.filter((c: any) => {
          const objeto = (c.objeto || c.objetoCompra || "").toLowerCase();
          const matchesTerm = objeto.includes(termLower);
          const matchesStateFilter = matchesState(c.orgaoEntidade);
          const matchesOrgan = matchesOrganType(c.orgaoEntidade);
          return matchesTerm && matchesStateFilter && matchesOrgan;
        });

        console.log(
          `Contratações filtradas para "${term}":`,
          filteredContratacoes.length,
        );

        for (const contratacao of filteredContratacoes.slice(0, 5)) {
          if (aggregatedData.sampleContracts.length >= 10) break;

          const numeroControle = contratacao.numeroControlePNCP || "";
          const cnpjOrgao = (contratacao.orgaoEntidade?.cnpj || "").replace(/\D/g, "");
          const anoCompra =
            contratacao.anoCompra ||
            new Date(contratacao.dataPublicacaoPncp || "").getFullYear();
          const sequencialCompra = contratacao.sequencialCompra || "";

          let parsedCnpj = cnpjOrgao;
          let parsedAno = anoCompra;
          let parsedSequencial = sequencialCompra;

          if (numeroControle && numeroControle.includes("-")) {
            const match = numeroControle.match(/^(\d+)-(\d+)-(\d+)\/(\d+)$/);
            if (match) {
              parsedCnpj = match[1];
              parsedSequencial = match[3];
              parsedAno = parseInt(match[4]);
            }
          }

          let documentLink = "";
          let pncpPortalLink = "";

          if (
            contratacao.linkSistemaOrigem &&
            contratacao.linkSistemaOrigem.startsWith("http")
          ) {
            documentLink = contratacao.linkSistemaOrigem;
          }

          if (parsedCnpj && parsedAno && parsedSequencial) {
            if (!documentLink) {
              documentLink =
                `https://pncp.gov.br/api/pncp/v1/orgaos/${parsedCnpj}/compras/${parsedAno}/${parsedSequencial}/arquivos/1`;
            }
            pncpPortalLink =
              `https://pncp.gov.br/app/editais/${parsedCnpj}/1/${parsedAno}/${parsedSequencial}`;
          } else if (numeroControle) {
            pncpPortalLink = `https://pncp.gov.br/app/editais/${numeroControle}`;
          }

          if (!documentLink) {
            documentLink = pncpPortalLink || "https://pncp.gov.br/app/editais";
          }

          aggregatedData.sampleContracts.push({
            title: contratacao.objeto || contratacao.objetoCompra || "Licitação",
            value:
              contratacao.valorTotalEstimado || contratacao.valorTotalHomologado || 0,
            date: contratacao.dataPublicacaoPncp || contratacao.dataAberturaProposta || "",
            organ: contratacao.orgaoEntidade?.razaoSocial || "Órgão não informado",
            link: documentLink,
            pncpLink: pncpPortalLink,
          });
        }

        aggregatedData.rawData.contratacoes.push(...filteredContratacoes);
      } catch (termError) {
        console.error(`Erro ao buscar termo "${term}":`, termError);
      }
    }

    aggregatedData.competitors = Array.from(competitorsMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 20)
      .map((c) => ({
        name: c.name,
        cnpj: c.cnpj,
        totalValue: c.totalValue,
        contractCount: c.contractCount,
        period: `${c.contracts12m} contratos (12m) / ${c.contracts24m} contratos (24m)`,
      }));

    if (aggregatedData.totalValue24Months === 0 && aggregatedData.competitors.length === 0) {
      console.log("Nenhum dado encontrado no PNCP para os termos pesquisados");
    }

    console.log("Dados agregados:", {
      totalValue12Months: aggregatedData.totalValue12Months,
      totalValue24Months: aggregatedData.totalValue24Months,
      totalQuantity12Months: aggregatedData.totalQuantity12Months,
      totalQuantity24Months: aggregatedData.totalQuantity24Months,
      competitorsCount: aggregatedData.competitors.length,
      contractsCount: aggregatedData.sampleContracts.length,
      rawContratosCount: aggregatedData.rawData.contratos.length,
      rawContratacoes: aggregatedData.rawData.contratacoes.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: aggregatedData,
        searchTerms,
        period: {
          start: dataInicial,
          end: dataFinal,
        },
        paginationInfo: {
          maxPagesPerChunk: { contratos: 3, contratacoes: 2 },
          pageSizeUsed: 100,
          chunks: dateRanges24m.length,
          modalidadesContratacao: MODALIDADES_CONTRATACAO,
          note:
            "Busca com paginação + chunking (<=365 dias) e modalidades (contratações) para evitar respostas vazias.",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Erro na função pncp-market-intelligence:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro ao buscar dados do PNCP",
        details: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
