import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KnowledgeItem {
  title: string;
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const knowledgeItems: KnowledgeItem[] = [
      {
        title: "Motivação com foco na assertividade",
        content: "Organização dos prospects. No presencial, aperto de mão e olho no olho. Busco o segmento ou empresa em que o fechamento acontece de uma maneira mais rápida e com valor elevado da proposta comercial."
      },
      {
        title: "OMIE - Qualificação",
        content: "Qual o critério? Atualmente usando o criterio de ir direto para \"apresentação\"."
      },
      {
        title: "OMIE - Agendamento de tarefas",
        content: "Registro o que ocorreu no dia e também os próximos passos, me alertando para seguir ou não. Um diferenciador é quem me Responde rápido, nesse caso prossigo até receber a resposta do sim ou não."
      },
      {
        title: "OMIE - CNPJ Matriz - link",
        content: "Exemplo 03.830.607/0001-97 - link: https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp"
      },
      {
        title: "OMIE - CNPJ Matriz - importância",
        content: "Para saber se essa conta já está sendo trabalhada. Se colocar CNPJs diferentes, corre-se o risco de duas pessoas trabalharem na mesma conta."
      },
      {
        title: "OMIE - Oportunidade",
        content: "Quando não tenho o nome do contato para abrir a oportunidades, coloco o nome da empresa."
      },
      {
        title: "OMIE - Negociações - inicio",
        content: "Quando a empresa quer negociar os preços, quando é enviado o contrato de prestação de serviços, ou quando recebo a informação que está na diretoria ou jurídico avaliando."
      },
      {
        title: "OMIE - Caracteristica conta Concorrentes",
        content: "Effecti, Forcet, IBIS, (Winner - 90% área da saúde - site da empresa winner)"
      },
      {
        title: "OMIE: Caracteristica: Capital social - como consultar",
        content: "Informação de fácil acesso: colocar o CNPJ no Google e escrever 'capital social' da empresa que está consultando."
      },
      {
        title: "OMIE: Caracteristica: Capital social / porte empresa (link)",
        content: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp / porte empresa https://cnpj.biz/"
      },
      {
        title: "OMIE/ caracteristica: Feira - Agendamento",
        content: "Foco da visita para buscar uma melhor assertividade na abordagem e também conseguir as informações sobre o setor de licitação. Ex: quantas pessoas têm o departamento, volume de licitação em que participam."
      },
      {
        title: "OMIE/ caracteristica: Feira - visita",
        content: "Fazer rapport com a pessoa que me atende, me passando as informações das quais preciso, exemplo: celular, e-mail."
      },
      {
        title: "OMIE/ caracteristica: Feira - Como me organizo?",
        content: "Uso o recurso \"NOTAS\" no celular, onde deixo as empresas e a informação atualizada de quem vou procurar, deixando sinalizado para ganhar tempo na busca de informação."
      },
      {
        title: "OMIE/ caracteristica: Feira - Procedimento",
        content: "Antes de entrar no stand, vejo o nome da empresa e procuro em notas qual a observação colocada. Se tem nome, chego e pergunto se a pessoa está no stand, caso contrário, se a informação é que não estou conseguindo falar na empresa, busco pelo telefone e uma forma melhor de me comunicar. Procuro também pelo gerente comercial, onde dou uma introdução sobre os serviços que fazemos e pego o cartão de visita para enviar apresentação. Saio do stand e escrevo as observações da pessoa que me atendeu e tiro foto do cartão de visitas."
      },
      {
        title: "OMIE/ caracteristica: Feira - Pós - Procedimento",
        content: "Atualizo em tarefas as informações que recebi da empresa e deixo agendado o próximo passo. Se a informação é de enviar e-mail, ou de ligar ou usar o WhatsApp. Procuro na conversa, quando estou no stand com a pessoa, qual o canal que ele(a) opta para me retornar."
      },
      {
        title: "OMIE: Caracteristica - preparação visita feira",
        content: "Entro no site da feira e vou em expositores. Vou en NOTAS no celular, coloco a empresa e a última tarefa realizada, com o nome de quem devo procurar ou não. 1) Procuro alguém no stand e pergunto se tem depto de licitação, se sim, pego o celular e/ou e-mail da pessoa responsável, coordenador, gerente. Caso encontre a pessoa da qual eu procuro, se tiver tempo, eu falo dos diferenciais da plataforma, uso leitura de edital IA, e faço o convite para call. 99% me dão o cartão ou senão o contato e deixo frisado da minha intenção para call."
      },
      {
        title: "OMIE/ caracteristica - Região",
        content: "Quais são os estados e cidades que mais se destacam dentro de cada segmento? Estudo do comportamento de atendimento e fechamento de propostas ou prospecções. Interesse de quando for São Paulo ter a possibilidade de visita presencial (exploro essa informação na feira)."
      },
      {
        title: "OMIE/ caracteristica - Porte Demais",
        content: "I-Ganhei - Tem peso na minha escolha se continuo ou se paro. Analiso o segmento também. Tem segmentos em que o capital social não é grande e outros que são bastante expressivos."
      },
      {
        title: "OMIE/ caracteristica - Porte pequeno",
        content: "Ganhei licitação e i-Documentei. Quando o Serviço Ganhei Licitação e i-Documentei, o porte da empresa é geralmente de pequeno porte. É uma característica desses dois serviços. Não é relevante."
      },
      {
        title: "Dados Importantes - Telefone Empresas",
        content: "Sempre ligar para empresa, ou responsável, passando todas as informações dos nossos diferenciais."
      },
      {
        title: "Dados Importantes - Telefone Empresas - objetivo",
        content: "Objetivo de fazer a reunião ou apresentação. Sempre uso o gancho - se a empresa concorre por licitação."
      },
      {
        title: "Dados Importantes - Telefone Empresas - Diferencial",
        content: "Fazer a leitura de editais com inteligência artificial, explicando o diferencial de apenas sinalizar os editais que possam ser do interesse da empresa e isso em 5min. Demostrar a segurança, a facilidade de usar e a possibilidade de fazer reunião on-line."
      },
      {
        title: "Dados Importantes - Telefone Empresas - Gatilho mental ou uso de preço e condição de pagamento",
        content: "Falo que o serviço cabe no orçamento deles. Geralmente de empresas privadas que me retornam perguntando do valor desse nosso serviço."
      },
      {
        title: "Dados Importantes - Telefone Empresas - Procedimento de busca",
        content: "Sites de busca. Ex: Google, busco pelo cargo, exemplo: coordenador de licitação, gerente de licitação da empresa. Depois ligo para empresa e peço para falar com essa pessoa. Depois ligo perguntando se posso enviar um e-mail sobre os nossos serviços. Se for positivo marco call e envio nosso material."
      },
      {
        title: "Dados Importantes - Telefone Empresas - Buscar o foco em \"dor\" ou segmento",
        content: "Pergunto se concorrem por licitação, ou faço o caminho inverso, procurando em sites de licitações."
      },
      {
        title: "Quais são os gatilhos que fazem a pessoa fechar?",
        content: "Busca - estar presente no Ganhei licitação e no iDocumentei. (quando está nos dois, tem uma chance maior do cliente fechar ou dar andamento as etapas - fazer reunião). Queixas: não encontrou um e-mail, não recebeu e-mail, site errado, não encontrou informações de locais específicos, exemplo: como é o credenciamento, se tem que cadastrar no site do estado ou no site da prefeitura."
      },
      {
        title: "Organização de prospect (entendimento sobre a empresa)",
        content: "Definir muito bem a persona do prospect - Segmentos, capital social, porte. Facilitar a comunicação e facilitar a triagem de quais prospects devem ser trabalhados."
      },
      {
        title: "Técnicas - Como você define o que deve prosperar ou não?",
        content: "De 1 a 10 - Pessoa que entende de licitação, que concorre por licitação e valor de proposta (2 - iGanhei, 9 - Ganhei licitação, 10 - iDocumentei). Quando não entendem de licitação, perco mais tempo para \"educar\", já que eles se perdem na reunião por não entenderem a linguagem e o processo de licitação."
      },
      {
        title: "Técnicas - Metodologia de Abordagem",
        content: "Perguntar se a empresa concorre por licitação. Se sim, envio Whatsapp, LinkedIn, apresentando nossos serviços com o gancho \"leitura de editais com inteligência artificial\", chamando atenção de quem atende ao telefone. Caso negativo, excluo da minha lista de prospecção ou trato num médio ou longo prazo."
      },
      {
        title: "Técnicas - Rapport",
        content: "Fazer rapport de imediato, sabendo o nome da pessoa e não sendo genérico. Sempre buscando o nome nas redes sociais, cargo, telefone particular. Fazer menção sempre de alguma informação que consigo relacionar com a pessoa, exemplo: formação, cargo, empresa."
      },
      {
        title: "Definição - Comportamento do cliente",
        content: "Qual o segmento comportamento e quem decide - jurídico, setor de licitação, setor compras, diretoria."
      },
      {
        title: "Definição - Estrutura Startup",
        content: "Empresas novas, até 5 anos ou 6 anos, empresas que entendem ser a hora de investir, de se organizar, concorrer por licitação. Buscar ferramentas para ganhar competitividade e confiança no processo - esses clientes fazem reuniões e querem conhecer a ferramenta o quanto antes."
      },
      {
        title: "Definição - Estrutura licitante - Gestão de documentos",
        content: "Empresas mais estruturadas, buscam ganhar tempo, mais organização, reduzir erros em certidões. Quem busca organizaão busca no geral o nosso serviço."
      },
      {
        title: "Gatilhos para prospectar - Capital Social / Porte da empresa",
        content: "Proposta acima de R$ 4.000,00 - atenção Capital Social acima de 50 mil mensal."
      },
      {
        title: "Gatilhos para prospectar - Característica de segmento",
        content: "Volume de participação em licitação. Conseguir por Ganhei licitação essas empresas que participam. Organização da minha lista de empresas, definindo quais empresas que eu vou realizar primeiro a abordagem. Busco segmentos que tenham mais facilidade na negociação da venda ou adesão dos serviços."
      },
      {
        title: "Gatilhos para prospectar - Região",
        content: "Estados onde a busca faz mais sentido - São Paulo, Santa Catarina, Paraná, Rio de Janeiro."
      },
      {
        title: "Contato - Como fazer / Caracteristica",
        content: "Já deixar em aberto reunião com o cliente na primeira conversa, não importa se não conhecemos. Tempo do cliente - respeitando sempre o momento que ele tem para nos dar atenção."
      },
      {
        title: "Contato - Depois da Ligação - Estrategia",
        content: "Ligar, caso não retorno, vai por WhatsApp a tarde ou no outro dia, depois LinkedIn. Não deixar de abrir uma oportunidade/prospect deixando as características certas que possam definir o tipo de prospecção que estou fazendo."
      },
      {
        title: "Contato - Retornos",
        content: "WhatsApp e telefone - são as ferramentas que me dão mais retorno quando pensando em conversar com o cliente. Deixo claro que bati na porta. Vou fazer ligação, deixo recado no whatsapp depois de falar com a secretaria ou recepcionista e geralmente tenho um índice de retorno positivo."
      },
      {
        title: "Formas de abordagens no telefone",
        content: "Busco sempre uma linguagem que não seja comercial, mas sim uma linguagem de relacionamento. Mostro interesse de saber de como estão indo as coisas antes de falar dos nossos serviços. Sempre buscando saber se posso ligar em outro momento, por entender que devo saber qual o momento que ele vai me dar a atenção."
      },
      {
        title: "Estruturas de E-mails com valor ou procedimentos",
        content: "E-mails personalizados, não usar algo genérico. Buscar entender o que o prospect busca e o que a plataforma pode atender essa necessidade. E-mails funcionam quando tem apresentação online anteriormente ou telefone. E-mail é uma forma de registro da informação que foi passada, estou sempre deixando muito claro qual foi o procedimento e qual será o próximo passo."
      },
      {
        title: "Estruturas Organizacionais do fluxo",
        content: "Tarefa registrada - Tarefas detalhadas e organizadas me permitem ser mais eficiente e ágil, evitando perder tempo pensando nos próximos passos ou no que fazer a seguir."
      },
      {
        title: "Como ter mais resultados - Diferenciais - Organizacionais",
        content: "Fazer as coisas que os vendedores não fazem - buscar diferencial na abordagem - envio de e-mails, whatsapp, fazer o máximo de interação, dando informações sobre quem somos. Estudar o comportamento da empresa, saber se ela tem ou não investimento. Não perco tempo com quem não tem investimento. FOCO na minha lista de prospecção e perfil de cliente que busco."
      },
      {
        title: "Como ter mais resultados - Diferenciais - Estratégia",
        content: "Estudo de segmentos, porte de empresa, regiões - comportamento de compra. O aumento de vendas está relacionado com o volume de contato com a lista perfilada com esses estudos que fazemos."
      },
      {
        title: "Como ter mais resultados - Diferenciais - Estrutura",
        content: "Criar lista de empresas que estão nos sites dos canais de licitações - Ganhei licitação e iDocumentei. Como fazer? Pego empresas que fazem o gol da empresa - segmento e valor de contrato."
      },
      {
        title: "Definição de prioridade na abordagem",
        content: "Empresas que não estão na base de clientes, empresas que já tiveram uma conversa nossa. Definição de prioridade: quando vai começar a prospecção, fazer a qualificação da sua lista. Organizar e atacar empresas certas. Ver as características: segmento, capital social, porte e região. Fazer uma análise com CNPJ, ver quantos CNPJs tem a empresa, saber se é uma rede ou se tem apenas uma empresa."
      },
      {
        title: "Qual linguagem e jeito de falar com cada empresa de acordo com o segmento",
        content: "Engenharia civil - falar de contrato, valor de obra, em qual estado está trabalhando. Saúde - falar de contrato, credenciamento (municipio e estado). Medicamentos - falar sobre a rede de fornecimento. Alimentação - falar sobre a rede de fornecimento. Escritórios - valor do contrato. Gestão pública ou representação - ganham para fazer gestão do processo de licitação para seus clientes."
      },
      {
        title: "Processo de call - Apresentação",
        content: "Objetivo: entender qual a dor do cliente para conseguir dar exemplo que a ferramenta atende aquela dor. Não vender nosso produto antes de entender o cliente."
      },
      {
        title: "Processo de call - Controle de Call",
        content: "Controlar a call para não perder tempo com informações que não são importantes. Usar informações que deem um gancho para nossa apresentação, por exemplo: ferramentas que não fazem o que ele busca e deixar claro que a nossa ferramenta faz."
      },
      {
        title: "Processo de call - Fechamento",
        content: "Enviar contrato ou fazer o controle de pagamento e ativação da plataforma. Não perder tempo com quem não tem intenção em contratar. Dar prazo de resposta - Exemplo: um dia, dois dias. Dar um exemplo: envio proposta e pergunto se tem alguma dúvida. Caso não tenha, entro com o procedimento de fechamento."
      }
    ];

    // Check for existing titles to prevent duplicates
    const { data: existingItems, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('title');

    if (fetchError) {
      console.error('Error fetching existing items:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar itens existentes', details: fetchError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Set of existing titles for efficient lookup (case-insensitive)
    const existingTitles = new Set(
      (existingItems || []).map(item => item.title.toLowerCase().trim())
    );

    // Filter out items that already exist
    const newItems = knowledgeItems.filter(
      item => !existingTitles.has(item.title.toLowerCase().trim())
    );

    const duplicateCount = knowledgeItems.length - newItems.length;

    // If no new items to insert, return early
    if (newItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Todos os itens já existem na base de conhecimento.',
          inserted: 0,
          duplicates: duplicateCount,
          total: knowledgeItems.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert only new items
    const itemsToInsert = newItems.map(item => ({
      title: item.title,
      content: item.content,
      category: 'comercial',
      type: 'article',
      created_by: user.id,
    }));

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert(itemsToInsert)
      .select();

    if (error) {
      console.error('Error inserting knowledge items:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao importar itens', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${data?.length || 0} novos itens importados. ${duplicateCount} duplicados ignorados.`,
        inserted: data?.length || 0,
        duplicates: duplicateCount,
        total: knowledgeItems.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in import-knowledge-base function:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
