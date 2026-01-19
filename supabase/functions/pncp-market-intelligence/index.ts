import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PNCPContrato {
  dataVigenciaInicio: string;
  dataVigenciaFim: string;
  valorInicial: number;
  valorFinal: number;
  razaoSocialFornecedor: string;
  cnpjFornecedor: string;
  objetoContrato: string;
  numeroControlePNCP: string;
  orgaoEntidade: {
    razaoSocial: string;
    cnpj: string;
  };
}

interface PNCPItem {
  descricao: string;
  quantidade: number;
  valorUnitarioEstimado: number;
  valorTotal: number;
  unidadeMedida: string;
}

interface PNCPContratacao {
  numeroControlePNCP: string;
  objeto: string;
  valorTotalEstimado: number;
  dataPublicacaoPncp: string;
  dataAberturaProposta: string;
  modalidadeLicitacao: {
    nome: string;
  };
  orgaoEntidade: {
    razaoSocial: string;
    cnpj: string;
  };
  linkSistemaOrigem: string;
  anoCompra?: number;
  sequencialCompra?: string;
}

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerms, filters } = await req.json();
    const stateFilter = filters?.state && filters.state !== 'all' ? filters.state : '';
    const organTypeFilter = filters?.organType && filters.organType !== 'all' ? filters.organType : '';

    if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
      return new Response(
        JSON.stringify({ error: 'searchTerms é obrigatório e deve ser um array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Buscando dados do PNCP para:', searchTerms, 'Filtros:', { stateFilter, organTypeFilter });

    const now = new Date();
    const date24MonthsAgo = new Date(now);
    date24MonthsAgo.setMonth(date24MonthsAgo.getMonth() - 24);
    const date12MonthsAgo = new Date(now);
    date12MonthsAgo.setMonth(date12MonthsAgo.getMonth() - 12);

    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0].replace(/-/g, '');
    };

    const dataInicial = formatDate(date24MonthsAgo);
    const dataFinal = formatDate(now);

    // Helper function to match state
    const matchesState = (organ: any): boolean => {
      if (!stateFilter) return true;
      const uf = organ?.uf || organ?.unidadeOrgao?.uf || organ?.municipio?.uf || '';
      return uf.toUpperCase() === stateFilter.toUpperCase();
    };

    // Helper function to match organ type
    const matchesOrganType = (organ: any): boolean => {
      if (!organTypeFilter) return true;
      const razaoSocial = (organ?.razaoSocial || organ?.nomeUnidade || '').toLowerCase();
      const esferaId = organ?.esferaId || organ?.unidadeOrgao?.esferaId || '';
      
      switch (organTypeFilter) {
        case 'federal':
          return esferaId === 'F' || razaoSocial.includes('ministério') || razaoSocial.includes('federal');
        case 'estadual':
          return esferaId === 'E' || razaoSocial.includes('estado') || razaoSocial.includes('estadual');
        case 'municipal':
          return esferaId === 'M' || razaoSocial.includes('município') || razaoSocial.includes('prefeitura');
        case 'autarquia':
          return razaoSocial.includes('autarquia') || razaoSocial.includes('instituto') || razaoSocial.includes('inss');
        case 'empresa_publica':
          return razaoSocial.includes('empresa') || razaoSocial.includes('correios') || razaoSocial.includes('caixa');
        case 'fundacao':
          return razaoSocial.includes('fundação') || razaoSocial.includes('fundacao');
        default:
          return true;
      }
    };

    // Agregar dados de todas as buscas
    const aggregatedData: MarketData = {
      totalValue12Months: 0,
      totalValue24Months: 0,
      totalQuantity12Months: 0,
      totalQuantity24Months: 0,
      competitors: [],
      sampleContracts: [],
      rawData: { contratos: [], contratacoes: [] }
    };

    const competitorsMap = new Map<string, { name: string; cnpj: string; totalValue: number; contractCount: number; contracts12m: number; contracts24m: number }>();

    // Buscar contratos para cada termo
    for (const term of searchTerms) {
      try {
        // Buscar contratos
        const contratosUrl = `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=1&tamanhoPagina=50`;
        console.log('Buscando contratos:', contratosUrl);
        
        const contratosResponse = await fetch(contratosUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; EvoluaCRM/1.0)'
          }
        });

        if (contratosResponse.ok) {
          const contratosData = await contratosResponse.json();
          console.log('Contratos recebidos:', contratosData?.data?.length || 0);
          
          const contratos = contratosData?.data || contratosData || [];
          
          // Filtrar por termo de busca e filtros de estado/órgão
          const filteredContratos = Array.isArray(contratos) 
            ? contratos.filter((c: any) => {
                const objeto = (c.objetoContrato || c.objeto || '').toLowerCase();
                const matchesTerm = objeto.includes(term.toLowerCase());
                const matchesStateFilter = matchesState(c.orgaoEntidade || c.unidadeOrgao);
                const matchesOrgan = matchesOrganType(c.orgaoEntidade || c.unidadeOrgao);
                return matchesTerm && matchesStateFilter && matchesOrgan;
              })
            : [];

          console.log(`Contratos filtrados para "${term}":`, filteredContratos.length);

          for (const contrato of filteredContratos) {
            const contratoDate = new Date(contrato.dataVigenciaInicio || contrato.dataPublicacaoPncp || contrato.dataAssinatura);
            const valor = contrato.valorInicial || contrato.valorFinal || contrato.valorTotal || 0;
            
            // Acumular valores por período
            if (contratoDate >= date12MonthsAgo) {
              aggregatedData.totalValue12Months += valor;
              aggregatedData.totalQuantity12Months += 1;
            }
            if (contratoDate >= date24MonthsAgo) {
              aggregatedData.totalValue24Months += valor;
              aggregatedData.totalQuantity24Months += 1;
            }

            // Mapear concorrentes
            const fornecedorCnpj = contrato.cnpjFornecedor || contrato.fornecedor?.cnpj;
            const fornecedorNome = contrato.razaoSocialFornecedor || contrato.fornecedor?.razaoSocial || 'Não informado';
            
            if (fornecedorCnpj) {
              const existing = competitorsMap.get(fornecedorCnpj);
              if (existing) {
                existing.totalValue += valor;
                existing.contractCount += 1;
                if (contratoDate >= date12MonthsAgo) {
                  existing.contracts12m += 1;
                }
                existing.contracts24m += 1;
              } else {
                competitorsMap.set(fornecedorCnpj, {
                  name: fornecedorNome,
                  cnpj: fornecedorCnpj,
                  totalValue: valor,
                  contractCount: 1,
                  contracts12m: contratoDate >= date12MonthsAgo ? 1 : 0,
                  contracts24m: 1
                });
              }
            }

            // Adicionar aos contratos de amostra
            if (aggregatedData.sampleContracts.length < 5) {
              const numeroControle = contrato.numeroControlePNCP || contrato.numero || '';
              const cnpjOrgao = (contrato.orgaoEntidade?.cnpj || contrato.unidadeOrgao?.cnpj || '').replace(/\D/g, '');
              const anoContrato = contrato.anoContrato || new Date(contrato.dataVigenciaInicio || contrato.dataAssinatura || '').getFullYear();
              const sequencialContrato = contrato.sequencialContrato || '';
              
              // Extrair dados do numeroControlePNCP se disponível (formato: cnpj-tipo-sequencial/ano)
              let parsedCnpj = cnpjOrgao;
              let parsedAno = anoContrato;
              let parsedSequencial = sequencialContrato;
              
              if (numeroControle && numeroControle.includes('-')) {
                const match = numeroControle.match(/^(\d+)-(\d+)-(\d+)\/(\d+)$/);
                if (match) {
                  parsedCnpj = match[1];
                  parsedSequencial = match[3];
                  parsedAno = parseInt(match[4]);
                }
              }
              
              // Construir link direto para o documento do contrato
              // A API correta é: /orgaos/{cnpj}/contratos/{ano}/{sequencial}/arquivos/{sequencialArquivo}
              let documentLink = '';
              let pncpPortalLink = '';
              
              if (contrato.linkSistemaOrigem && contrato.linkSistemaOrigem.startsWith('http')) {
                documentLink = contrato.linkSistemaOrigem;
              }
              
              if (parsedCnpj && parsedAno && parsedSequencial) {
                // Link direto para download do primeiro arquivo
                if (!documentLink) {
                  documentLink = `https://pncp.gov.br/api/pncp/v1/orgaos/${parsedCnpj}/contratos/${parsedAno}/${parsedSequencial}/arquivos/1`;
                }
                // Link para visualizar no portal PNCP
                pncpPortalLink = `https://pncp.gov.br/app/contratos/${parsedCnpj}/2/${parsedAno}/${parsedSequencial}`;
              } else if (numeroControle) {
                pncpPortalLink = `https://pncp.gov.br/app/contratos/${numeroControle}`;
              }
              
              if (!documentLink) {
                documentLink = pncpPortalLink || 'https://pncp.gov.br/app/editais';
              }
              
              aggregatedData.sampleContracts.push({
                title: contrato.objetoContrato || contrato.objeto || 'Contrato sem título',
                value: valor,
                date: contrato.dataVigenciaInicio || contrato.dataPublicacaoPncp || '',
                organ: contrato.orgaoEntidade?.razaoSocial || contrato.unidadeOrgao?.nomeUnidade || 'Órgão não informado',
                link: documentLink,
                pncpLink: pncpPortalLink
              });
            }

            aggregatedData.rawData.contratos.push(contrato);
          }
        }

        // Buscar contratações/licitações
        const contratacaoUrl = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=1&tamanhoPagina=50`;
        console.log('Buscando contratações:', contratacaoUrl);

        const contratacaoResponse = await fetch(contratacaoUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; EvoluaCRM/1.0)'
          }
        });

        if (contratacaoResponse.ok) {
          const contratacaoData = await contratacaoResponse.json();
          console.log('Contratações recebidas:', contratacaoData?.data?.length || 0);
          
          const contratacoes = contratacaoData?.data || contratacaoData || [];
          
          // Filtrar por termo de busca e filtros de estado/órgão
          const filteredContratacoes = Array.isArray(contratacoes)
            ? contratacoes.filter((c: any) => {
                const objeto = (c.objeto || c.objetoCompra || '').toLowerCase();
                const matchesTerm = objeto.includes(term.toLowerCase());
                const matchesStateFilter = matchesState(c.orgaoEntidade);
                const matchesOrgan = matchesOrganType(c.orgaoEntidade);
                return matchesTerm && matchesStateFilter && matchesOrgan;
              })
            : [];

          console.log(`Contratações filtradas para "${term}":`, filteredContratacoes.length);

          // Adicionar links de editais das contratações
          for (const contratacao of filteredContratacoes.slice(0, 3)) {
            if (aggregatedData.sampleContracts.length < 5) {
              const numeroControle = contratacao.numeroControlePNCP || '';
              const cnpjOrgao = (contratacao.orgaoEntidade?.cnpj || '').replace(/\D/g, '');
              const anoCompra = contratacao.anoCompra || new Date(contratacao.dataPublicacaoPncp || '').getFullYear();
              const sequencialCompra = contratacao.sequencialCompra || '';
              
              // Extrair dados do numeroControlePNCP se disponível (formato: cnpj-tipo-sequencial/ano)
              let parsedCnpj = cnpjOrgao;
              let parsedAno = anoCompra;
              let parsedSequencial = sequencialCompra;
              
              if (numeroControle && numeroControle.includes('-')) {
                const match = numeroControle.match(/^(\d+)-(\d+)-(\d+)\/(\d+)$/);
                if (match) {
                  parsedCnpj = match[1];
                  parsedSequencial = match[3];
                  parsedAno = parseInt(match[4]);
                }
              }
              
              // Construir link direto para o edital/documento
              // A API correta é: /orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos/{sequencialArquivo}
              let documentLink = '';
              let pncpPortalLink = '';
              
              if (contratacao.linkSistemaOrigem && contratacao.linkSistemaOrigem.startsWith('http')) {
                documentLink = contratacao.linkSistemaOrigem;
              }
              
              if (parsedCnpj && parsedAno && parsedSequencial) {
                // Link direto para download do primeiro arquivo (edital)
                if (!documentLink) {
                  documentLink = `https://pncp.gov.br/api/pncp/v1/orgaos/${parsedCnpj}/compras/${parsedAno}/${parsedSequencial}/arquivos/1`;
                }
                // Link para visualizar no portal PNCP
                pncpPortalLink = `https://pncp.gov.br/app/editais/${parsedCnpj}/1/${parsedAno}/${parsedSequencial}`;
              } else if (numeroControle) {
                pncpPortalLink = `https://pncp.gov.br/app/editais/${numeroControle}`;
              }
              
              if (!documentLink) {
                documentLink = pncpPortalLink || 'https://pncp.gov.br/app/editais';
              }
              
              aggregatedData.sampleContracts.push({
                title: contratacao.objeto || contratacao.objetoCompra || 'Licitação',
                value: contratacao.valorTotalEstimado || contratacao.valorTotalHomologado || 0,
                date: contratacao.dataPublicacaoPncp || contratacao.dataAberturaProposta || '',
                organ: contratacao.orgaoEntidade?.razaoSocial || 'Órgão não informado',
                link: documentLink,
                pncpLink: pncpPortalLink
              });
            }
          }

          aggregatedData.rawData.contratacoes.push(...filteredContratacoes);
        }

      } catch (termError) {
        console.error(`Erro ao buscar termo "${term}":`, termError);
      }
    }

    // Converter mapa de concorrentes para array ordenado
    aggregatedData.competitors = Array.from(competitorsMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 15)
      .map(c => ({
        name: c.name,
        cnpj: c.cnpj,
        totalValue: c.totalValue,
        contractCount: c.contractCount,
        period: `${c.contracts12m} contratos (12m) / ${c.contracts24m} contratos (24m)`
      }));

    // Log quando não encontrar dados - não usamos mais dados mockados
    if (aggregatedData.totalValue24Months === 0 && aggregatedData.competitors.length === 0) {
      console.log('Nenhum dado encontrado no PNCP para os termos pesquisados');
    }

    console.log('Dados agregados:', {
      totalValue12Months: aggregatedData.totalValue12Months,
      totalValue24Months: aggregatedData.totalValue24Months,
      competitorsCount: aggregatedData.competitors.length,
      contractsCount: aggregatedData.sampleContracts.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: aggregatedData,
        searchTerms,
        period: {
          start: dataInicial,
          end: dataFinal
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função pncp-market-intelligence:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao buscar dados do PNCP',
        details: String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
