import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const stateFilter = filters?.state && filters.state !== "all" ? filters.state : "";
    const organTypeFilter = filters?.organType && filters.organType !== "all" ? filters.organType : "";

    if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
      return new Response(
        JSON.stringify({ error: "searchTerms é obrigatório e deve ser um array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Buscando dados do PNCP para:", searchTerms, "Filtros:", { stateFilter, organTypeFilter });

    const now = new Date();
    // Simplificado: apenas últimos 12 meses (dentro do limite de 365 dias da API)
    const date12MonthsAgo = new Date(now);
    date12MonthsAgo.setMonth(date12MonthsAgo.getMonth() - 12);

    const formatDate = (date: Date) => {
      return date.toISOString().split("T")[0].replace(/-/g, "");
    };

    const dataInicial = formatDate(date12MonthsAgo);
    const dataFinal = formatDate(now);

    console.log("Período de busca:", dataInicial, "a", dataFinal);

    const pncpHeaders = {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; EvoluaCRM/1.0)",
    };

    const FETCH_TIMEOUT_MS = 20_000;

    const fetchPncpJson = async (url: string, label: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const startedAt = Date.now();

      try {
        console.log(`Fetching ${label}:`, url);

        const res = await fetch(url, {
          headers: pncpHeaders,
          signal: controller.signal,
        });

        const text = await res.text();
        const ms = Date.now() - startedAt;

        if (!res.ok) {
          console.log(`${label} HTTP ${res.status} (${ms}ms):`, text.slice(0, 300));
          return null;
        }

        try {
          return JSON.parse(text);
        } catch (e) {
          console.log(`${label} JSON inválido (${ms}ms):`, String(e), text.slice(0, 200));
          return null;
        }
      } catch (e) {
        const ms = Date.now() - startedAt;
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`${label} Erro de fetch (${ms}ms):`, msg);
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const normalizeText = (value: unknown) => {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    };

    const tokenize = (term: string) => normalizeText(term).split(" ").filter(Boolean);

    // Matching mais tolerante:
    // - Se o PNCP já recebeu `termo=...`, NÃO refiltramos por termo (evita zerar resultados)
    // - Quando usamos fallback sem termo, validamos por frase OU por pelo menos 1 token.
    const matchesAnyToken = (textNormalized: string, tokens: string[]) => {
      if (tokens.length === 0) return true;
      return tokens.some((t) => textNormalized.includes(t));
    };

    const matchesSearchTermFallback = (textNormalized: string, originalTerm: string, tokens: string[]) => {
      if (tokens.length === 0) return true;
      const termNormalized = normalizeText(originalTerm);
      if (termNormalized && textNormalized.includes(termNormalized)) return true;
      return matchesAnyToken(textNormalized, tokens);
    };

    const matchesState = (organ: any): boolean => {
      if (!stateFilter) return true;
      const uf = organ?.uf || organ?.unidadeOrgao?.uf || organ?.municipio?.uf || "";
      return uf.toUpperCase() === stateFilter.toUpperCase();
    };

    const matchesOrganType = (organ: any): boolean => {
      if (!organTypeFilter) return true;
      const razaoSocial = (organ?.razaoSocial || organ?.nomeUnidade || "").toLowerCase();
      const esferaId = organ?.esferaId || organ?.unidadeOrgao?.esferaId || "";

      switch (organTypeFilter) {
        case "federal":
          return esferaId === "F" || razaoSocial.includes("ministério") || razaoSocial.includes("federal");
        case "estadual":
          return esferaId === "E" || razaoSocial.includes("estado") || razaoSocial.includes("estadual");
        case "municipal":
          return esferaId === "M" || razaoSocial.includes("município") || razaoSocial.includes("prefeitura");
        case "autarquia":
          return razaoSocial.includes("autarquia") || razaoSocial.includes("instituto") || razaoSocial.includes("inss");
        case "empresa_publica":
          return razaoSocial.includes("empresa") || razaoSocial.includes("correios") || razaoSocial.includes("caixa");
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

    const competitorsMap = new Map<string, {
      name: string;
      cnpj: string;
      totalValue: number;
      contractCount: number;
      contracts12m: number;
    }>();

    const fetchWithPagination = async (
      baseUrl: string,
      label: string,
      maxPages = 3,
      pageSize = 100
    ): Promise<any[]> => {
      const allResults: any[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore && currentPage <= maxPages) {
        const url = `${baseUrl}&pagina=${currentPage}&tamanhoPagina=${pageSize}`;
        const data = await fetchPncpJson(url, `${label} p${currentPage}`);

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

      console.log(`${label} - Total: ${allResults.length} registros`);
      return allResults;
    };

    // Modalidades de contratação - apenas Pregão Eletrônico (mais comum)
    const MODALIDADES = [6];

    for (const term of searchTerms) {
      try {
        const encodedTerm = encodeURIComponent(term);
        const termTokens = tokenize(term);

        // =====================
        // CONTRATOS (12 meses, dentro do limite de 365 dias)
        // =====================
        console.log("Buscando contratos para:", term, "tokens:", termTokens);
        
        const contratosUrl = `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${dataInicial}&dataFinal=${dataFinal}&termo=${encodedTerm}`;
        let usedContratosFallback = false;
        let contratos = await fetchWithPagination(contratosUrl, "Contratos", 5, 100);

        // Fallback sem termo
        if (contratos.length === 0) {
          usedContratosFallback = true;
          console.log("Fallback: buscando contratos sem termo");
          const fallbackUrl = `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
          contratos = await fetchWithPagination(fallbackUrl, "Contratos (fallback)", 3, 100);
        }

        // Filtrar por termo (normalizado) + estado/órgão
        const filteredContratos = contratos.filter((c: any) => {
          const objeto = c.objetoContrato || c.objeto || "";
          const descricao = c.descricao || "";
          const fornecedor = c.razaoSocialFornecedor || c.fornecedor?.razaoSocial || "";
          const orgao = c.orgaoEntidade?.razaoSocial || c.unidadeOrgao?.nomeUnidade || "";
          
          const textNormalized = normalizeText(`${objeto} ${descricao} ${fornecedor} ${orgao}`);
          // Se não usamos fallback, confiamos no filtro do PNCP (termo=...)
          const matchesTerm = usedContratosFallback
            ? matchesSearchTermFallback(textNormalized, term, termTokens)
            : true;
          const matchesStateFilter = matchesState(c.orgaoEntidade || c.unidadeOrgao);
          const matchesOrgan = matchesOrganType(c.orgaoEntidade || c.unidadeOrgao);
          return matchesTerm && matchesStateFilter && matchesOrgan;
        });

        console.log(`Contratos filtrados para "${term}":`, filteredContratos.length);

        for (const contrato of filteredContratos) {
          const valor = contrato.valorInicial || contrato.valorFinal || contrato.valorTotal || 0;

          aggregatedData.totalValue12Months += valor;
          aggregatedData.totalQuantity12Months += 1;
          // Também adiciona em 24m (são os mesmos dados neste caso simplificado)
          aggregatedData.totalValue24Months += valor;
          aggregatedData.totalQuantity24Months += 1;

          // Mapear concorrentes
          const fornecedorCnpj = contrato.cnpjFornecedor || contrato.fornecedor?.cnpj;
          const fornecedorNome = contrato.razaoSocialFornecedor || contrato.fornecedor?.razaoSocial || "Não informado";

          if (fornecedorCnpj) {
            const existing = competitorsMap.get(fornecedorCnpj);
            if (existing) {
              existing.totalValue += valor;
              existing.contractCount += 1;
              existing.contracts12m += 1;
            } else {
              competitorsMap.set(fornecedorCnpj, {
                name: fornecedorNome,
                cnpj: fornecedorCnpj,
                totalValue: valor,
                contractCount: 1,
                contracts12m: 1,
              });
            }
          }

          // Adicionar aos contratos de amostra
          if (aggregatedData.sampleContracts.length < 10) {
            const numeroControle = contrato.numeroControlePNCP || "";
            let documentLink = contrato.linkSistemaOrigem || "";
            let pncpPortalLink = "";

            if (numeroControle) {
              pncpPortalLink = `https://pncp.gov.br/app/contratos/${numeroControle}`;
              if (!documentLink) documentLink = pncpPortalLink;
            }

            if (!documentLink) documentLink = "https://pncp.gov.br/app/contratos";

            aggregatedData.sampleContracts.push({
              title: contrato.objetoContrato || contrato.objeto || "Contrato",
              value: valor,
              date: contrato.dataVigenciaInicio || contrato.dataPublicacaoPncp || "",
              organ: contrato.orgaoEntidade?.razaoSocial || contrato.unidadeOrgao?.nomeUnidade || "Órgão não informado",
              link: documentLink,
              pncpLink: pncpPortalLink,
            });
          }

          aggregatedData.rawData.contratos.push(contrato);
        }

        // =====================
        // CONTRATAÇÕES (exige modalidade)
        // =====================
        console.log("Buscando contratações para:", term);
        let contratacoes: any[] = [];
        let usedContratacoesFallback = false;

        for (const modalidade of MODALIDADES) {
          const contratacaoUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicial}&dataFinal=${dataFinal}&termo=${encodedTerm}&codigoModalidadeContratacao=${modalidade}`;
          const modalidadeResults = await fetchWithPagination(contratacaoUrl, `Contratações M${modalidade}`, 2, 50);
          contratacoes.push(...modalidadeResults);
        }

        // Fallback sem termo (ainda com modalidade)
        if (contratacoes.length === 0) {
          usedContratacoesFallback = true;
          console.log("Fallback: buscando contratações sem termo");
          for (const modalidade of MODALIDADES) {
            const fallbackUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicial}&dataFinal=${dataFinal}&codigoModalidadeContratacao=${modalidade}`;
            const modalidadeResults = await fetchWithPagination(fallbackUrl, `Contratações (fallback) M${modalidade}`, 1, 50);
            contratacoes.push(...modalidadeResults);
          }
        }

        // Dedupe por numeroControlePNCP
        const seen = new Set<string>();
        contratacoes = contratacoes.filter((c: any) => {
          const key = c.numeroControlePNCP || "";
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Filtrar por termo (normalizado) + estado/órgão
        const filteredContratacoes = contratacoes.filter((c: any) => {
          const objeto = c.objeto || c.objetoCompra || "";
          const descricao = c.descricao || "";
          const orgao = c.orgaoEntidade?.razaoSocial || "";
          
          const textNormalized = normalizeText(`${objeto} ${descricao} ${orgao}`);
          const matchesTerm = usedContratacoesFallback
            ? matchesSearchTermFallback(textNormalized, term, termTokens)
            : true;
          const matchesStateFilter = matchesState(c.orgaoEntidade);
          const matchesOrgan = matchesOrganType(c.orgaoEntidade);
          return matchesTerm && matchesStateFilter && matchesOrgan;
        });

        console.log(`Contratações filtradas para "${term}":`, filteredContratacoes.length);

        // Adicionar aos contratos de amostra
        for (const contratacao of filteredContratacoes.slice(0, 5)) {
          if (aggregatedData.sampleContracts.length >= 10) break;

          const numeroControle = contratacao.numeroControlePNCP || "";
          let documentLink = contratacao.linkSistemaOrigem || "";
          let pncpPortalLink = "";

          if (numeroControle) {
            pncpPortalLink = `https://pncp.gov.br/app/editais/${numeroControle}`;
            if (!documentLink) documentLink = pncpPortalLink;
          }

          if (!documentLink) documentLink = "https://pncp.gov.br/app/editais";

          aggregatedData.sampleContracts.push({
            title: contratacao.objeto || contratacao.objetoCompra || "Licitação",
            value: contratacao.valorTotalEstimado || contratacao.valorTotalHomologado || 0,
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

    // Converter mapa de concorrentes para array ordenado
    aggregatedData.competitors = Array.from(competitorsMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 20)
      .map((c) => ({
        name: c.name,
        cnpj: c.cnpj,
        totalValue: c.totalValue,
        contractCount: c.contractCount,
        period: `${c.contracts12m} contratos (12m)`,
      }));

    const hasResults = 
      aggregatedData.rawData.contratos.length > 0 || 
      aggregatedData.rawData.contratacoes.length > 0;

    console.log("Dados agregados:", {
      totalValue12Months: aggregatedData.totalValue12Months,
      totalQuantity12Months: aggregatedData.totalQuantity12Months,
      competitorsCount: aggregatedData.competitors.length,
      contractsCount: aggregatedData.sampleContracts.length,
      rawContratosCount: aggregatedData.rawData.contratos.length,
      rawContratacoes: aggregatedData.rawData.contratacoes.length,
      hasResults,
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
          periodMonths: 12,
          modalidades: MODALIDADES,
          note: "Busca simplificada: últimos 12 meses, com paginação e modalidades de contratação",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função pncp-market-intelligence:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro ao buscar dados do PNCP",
        details: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
