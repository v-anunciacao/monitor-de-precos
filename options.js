// options.js
function obterDominioRaiz(hostname) {
  console.log('[DEBUG] obterDominioRaiz chamado com:', hostname);
  
  // Remove "www." do início, se existir
  hostname = hostname.replace(/^www\./, '');
  console.log('[DEBUG] Após remover www:', hostname);

  const partes = hostname.split('.');
  console.log('[DEBUG] Partes do hostname:', partes);

  // Lista de TLDs compostos conhecidos
  const tldsCompostos = ['com.br', 'co.uk', 'org.br', 'gov.br', 'net.br', 'edu.br']; // Adicione conforme necessário

  for (const tld of tldsCompostos) {
    if (hostname.endsWith(tld)) {
      console.log('[DEBUG] TLD composto detectado:', tld);
      const partesTLD = tld.split('.');
      const numPartesTLD = partesTLD.length;
      const numPartesHostname = partes.length;
      const dominio = partes.slice(numPartesHostname - numPartesTLD - 1).join('.');
      
      // Verificação adicional para garantir que o domínio extraído não é um TLD inválido
      if (dominio.split('.').length > 1) {
        console.log('[DEBUG] Dominio raiz extraído (TLD composto):', dominio);
        return dominio;
      }
    }
  }

  if (partes.length > 2) {
    const dominio = partes.slice(-2).join('.');
    console.log('[DEBUG] Dominio raiz extraído (múltiplas partes):', dominio);
    return dominio;
  }

  // Se chegar aqui, o domínio é inválido (ex: 'com' ou 'br')
  console.warn('[WARN] Domínio extraído é inválido:', hostname);
  return null; // Retorna null para indicar domínio inválido
}

var listaDominiosGlobal = [];

// [NOVO] Carregar todos os domínios e exibir na tabela
function carregarTabelaDominios() {
  console.log('carregarTabelaDominios iniciado em Log.');
  chrome.runtime.sendMessage({ action: 'obterTodosSitesCompleto' }, function(resposta) {
    if (chrome.runtime.lastError) {
      console.error('[ERROR] Erro ao obter sites (domínios):', chrome.runtime.lastError.message);
      return;
    }
    if (!resposta.success) {
      console.error('[ERROR] Erro ao obter sites (domínios):', resposta.error);
      return;
    }

    listaDominiosGlobal = resposta.sites;
    exibirTabelaDominios(listaDominiosGlobal);
  });
}

// [NOVO] Exibir a tabela de domínios
function exibirTabelaDominios(dominios) {
  console.log('exibirTabelaDominios chamado, total de itens:', dominios.length);
  var corpoTabela = $('#tabelaDominios tbody');
  corpoTabela.empty();

  dominios.forEach(function(item) {
    var metodoTipo = item.metodoExtracao && item.metodoExtracao.tipo ? item.metodoExtracao.tipo : '';
    var metodoAttr = item.metodoExtracao && item.metodoExtracao.nomeAttr ? item.metodoExtracao.nomeAttr : '';

    var linha = $('<tr>');
    linha.html(`
      <td>${item.dominio}</td>
      <td>${item.cssSelector}</td>
      <td>${item.attribute}</td>
      <td>${metodoTipo}</td>
      <td>${metodoAttr}</td>
      <td>
        <button class="btn btn-sm btn-primary editarDominioButton" data-id="${item.id}">Editar</button>
        <button class="btn btn-sm btn-danger excluirDominioButton" data-id="${item.id}">Excluir</button>
      </td>
    `);
    corpoTabela.append(linha);
  });

  // Atribuir eventos aos botões
  $('.editarDominioButton').on('click', function() {
    var idSite = $(this).data('id');
    exibirEdicaoDominio(idSite);
  });

  $('.excluirDominioButton').on('click', function() {
    var idSite = $(this).data('id');
    excluirDominio(idSite);
  });

  habilitarOrdenacaoTabela('#tabelaDominios');
}

// [NOVO] Exibir modal para editar domínio
function exibirEdicaoDominio(idSite) {
  console.log('exibirEdicaoDominio chamado com ID:', idSite);
  chrome.runtime.sendMessage({ action: 'obterSitePorId', idSite: idSite }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('[ERROR] exibirEdicaoDominio -> chrome.runtime.lastError:', chrome.runtime.lastError.message);
      return;
    }
    if (!response.success) {
      console.error('[ERROR] exibirEdicaoDominio -> Resposta:', response.error);
      return;
    }

    var site = response.site;
    console.log('Site retornado para edição:', site);

    $('#editarDominioId').val(site.id);
    $('#editarDominioCampo').val(site.dominio);
    $('#editarSelectorCampo').val(site.cssSelector);
    $('#editarAtributoCampo').val(site.attribute);

    var metodoTipo = site.metodoExtracao && site.metodoExtracao.tipo ? site.metodoExtracao.tipo : 'texto';
    var metodoAttr = site.metodoExtracao && site.metodoExtracao.nomeAttr ? site.metodoExtracao.nomeAttr : '';
    $('#editarMetodoTipoCampo').val(metodoTipo);
    $('#editarMetodoAttrCampo').val(metodoAttr);

    $('#editarDominioModal').modal('show');
  });
}

// [NOVO] Ao salvar alterações do modal de domínio
$('#editarDominioForm').on('submit', function(ev) {
  ev.preventDefault();
  salvarEdicaoDominio();
});

// [NOVO] Função que efetivamente salva as alterações do domínio
function salvarEdicaoDominio() {
  var idSite = $('#editarDominioId').val();
  var dominioAtualizado = $('#editarDominioCampo').val().trim();
  var selectorAtualizado = $('#editarSelectorCampo').val().trim();
  var atributoAtualizado = $('#editarAtributoCampo').val().trim();
  var metodoTipoAtualizado = $('#editarMetodoTipoCampo').val();
  var metodoAttrAtualizado = $('#editarMetodoAttrCampo').val().trim();

  // Montar objeto site completo
  var siteObj = {
    id: Number(idSite),
    dominio: dominioAtualizado,
    cssSelector: selectorAtualizado,
    attribute: atributoAtualizado,
    metodoExtracao: {
      tipo: metodoTipoAtualizado,
      nomeAttr: metodoAttrAtualizado
    }
  };

  console.log('Tentando atualizar siteObj em Log:', siteObj);

  chrome.runtime.sendMessage({ action: 'atualizarSite', site: siteObj }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('[ERROR] salvarEdicaoDominio -> chrome.runtime.lastError:', chrome.runtime.lastError.message);
      return;
    }
    if (!response.success) {
      console.error('[ERROR] salvarEdicaoDominio -> response:', response.error);
      return;
    }
    console.log('Site atualizado com sucesso. Fechando modal e recarregando tabela em Log.');
    $('#editarDominioModal').modal('hide');
    carregarTabelaDominios();
  });
}

// [NOVO] Função para excluir um domínio
function excluirDominio(idSite) {
  console.log('excluirDominio chamado com ID:', idSite);
  if (!confirm('Tem certeza de que deseja excluir este domínio?')) {
    console.log('Usuário cancelou exclusão do domínio em Log.');
    return;
  }

  chrome.runtime.sendMessage({ action: 'excluirSite', idSite: idSite }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('[ERROR] excluirDominio -> chrome.runtime.lastError:', chrome.runtime.lastError.message);
      return;
    }
    if (!response.success) {
      console.error('[ERROR] excluirDominio -> response:', response.error);
      return;
    }
    console.log('Domínio excluído com sucesso. Recarregando tabela em Log.');
    carregarTabelaDominios();
  });
}

$(document).ready(function() {
  if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined' || typeof chrome.storage === 'undefined') {
    console.error('As APIs do Chrome não estão disponíveis. Certifique-se de que a página está sendo executada no contexto da extensão.');
    return;
  }

  carregarStatus();
  carregarIntervaloTempo();
  carregarIntervaloApoiamentos();
  carregarProdutos();
  carregarTermos();
  carregarConfiguracoesTelegram();
  carregarLogs();

  if (window.location.pathname.includes('options.html')) {
    carregarListaModelos();
  }

  carregarSites();
	carregarTabelaDominios();

  if (localStorage.getItem('darkMode') === 'enabled') {
    enableDarkMode();
    $('#darkModeSwitch').prop('checked', true);
  }

  $('#analisarLinkButton').on('click', function() {
    var link = $('#link').val();
    var precoAtual = $('#precoAtual').val();

    if (!link || !precoAtual) {
      alert('Por favor, insira o link do produto e o valor a ser procurado.');
      return;
    }
    abrirModalSelecao(link);
  });

  $('#editarProdutoForm').on('submit', function(e) {
    e.preventDefault();
    salvarEdicaoProduto();
  });

  $('#editarTermoForm').on('submit', function(e) {
    e.preventDefault();
    salvarEdicaoTermo();
  });

  $(document).on('change', '.produtoAtivoSwitch', function() {
    var id = $(this).data('id');
    var ativo = $(this).is(':checked');
    chrome.runtime.sendMessage({ action: 'atualizarProdutoAtivo', id: id, ativo: ativo }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Erro ao atualizar status do produto:', chrome.runtime.lastError);
        return;
      }
      if (!response.success) {
        alert('Erro ao atualizar status do produto: ' + response.error);
      }
    });
  });

  $(document).on('change', '.termoAtivoSwitch', function() {
    var id = $(this).data('id');
    var ativo = $(this).is(':checked');
    chrome.runtime.sendMessage({ action: 'atualizarTermoAtivo', id: id, ativo: ativo }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Erro ao atualizar status do termo:', chrome.runtime.lastError);
        return;
      }
      if (!response.success) {
        alert('Erro ao atualizar status do termo: ' + response.error);
      }
    });
  });

  $('#executarAgoraButton').on('click', function() {
    chrome.runtime.sendMessage({ action: 'executarAgora' }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Erro ao executar pesquisa:', chrome.runtime.lastError);
        alert('Erro ao iniciar a pesquisa. Verifique o console para mais detalhes.');
        return;
      }
      if (response.success) {
        alert('Pesquisa iniciada.');
      } else {
        alert('Erro ao iniciar a pesquisa: ' + response.error);
      }
    });
  });

  $('#intervaloForm').on('submit', function(e) {
    e.preventDefault();
    definirIntervaloTempo();
  });

  $('#intervaloApoiamentosForm').on('submit', function(e) {
    e.preventDefault();
    definirIntervaloApoiamentos();
  });

  $('#verificarApoiamentosButton').on('click', function() {
    $('#resultadoApoiamentos').text('Verificando...');
    chrome.runtime.sendMessage({ action: 'verificarApoiamentosAgora' }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Erro ao verificar apoiamentos:', chrome.runtime.lastError);
        $('#resultadoApoiamentos').text('Erro na verificação.');
        return;
      }
      if (response.success) {
        $('#resultadoApoiamentos').text('Apoiamentos atuais: ' + response.totalApoiamentos.toLocaleString('pt-BR'));
      } else {
        $('#resultadoApoiamentos').text('Erro: ' + response.error);
      }
    });
  });

  $('#telegramForm').on('submit', function(e) {
    e.preventDefault();
    salvarConfiguracoesTelegram();
  });

  $('#atualizarLogsButton').on('click', function() {
    carregarLogs();
  });

  $('#limparLogsButton').on('click', function() {
    chrome.runtime.sendMessage({ action: 'excluirTodosLogs' }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Erro ao limpar logs:', chrome.runtime.lastError);
        alert('Erro ao limpar logs. Verifique o console para mais detalhes.');
        return;
      }
      if (response.success) {
        carregarLogs();
      } else {
        alert('Erro ao limpar logs: ' + response.error);
      }
    });
  });

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'statusAtualizado') {
    $('#status').text(request.status);
  } else if (request.action === 'novoLog') {
    adicionarLogNaTabela(request.log);
  } else if (request.action === 'atualizarCorLinha') {
    alterarCorLinhaProduto(request.id, request.encontrado);
    sendResponse({ success: true });
  } else if (request.action === 'produtoAtualizado') {
    atualizarLinhaProdutoNaTabela(request.produto);
    sendResponse({ success: true });
  }
});

function atualizarLinhaProdutoNaTabela(produtoAtualizado) {
  console.log('[DEBUG] atualizarLinhaProdutoNaTabela chamado para ID:', produtoAtualizado.id);

  // Seleciona a <tr> cujo data-id corresponde ao produto atualizado
  var linha = $('#tabelaProdutos').find('tr[data-id="' + produtoAtualizado.id + '"]');
  if (!linha || !linha.length) {
    console.warn('[WARN] Linha não encontrada na tabela para ID', produtoAtualizado.id);
    return;
  }

  // Atualiza as colunas de preço e menor preço (se for o caso)
  // Aqui assumimos que a ordem das colunas está: 
  //   0 Ativo | 1 Modelo | 2 Site | 3 Link | 4 Preço Atual | 5 Menor Preço | 6 Ações
  const precoAtualTd = linha.find('td').eq(4);
  const menorPrecoTd = linha.find('td').eq(5);

  // Formatações de preço (caso você tenha uma função "formatarPreco")
  const precoFormatado = formatarPreco(produtoAtualizado.precoAnterior);
  const menorPrecoFormatado = formatarPreco(produtoAtualizado.menorPreco);

  precoAtualTd.html(precoFormatado);
  menorPrecoTd.html(menorPrecoFormatado);

  console.log('[DEBUG] Linha do produto ID', produtoAtualizado.id, 'atualizada em Log.');
}

  $('#darkModeSwitch').on('change', function() {
    if ($(this).is(':checked')) {
      enableDarkMode();
    } else {
      disableDarkMode();
    }
  });

  $('#termoForm').on('submit', function(e) {
    e.preventDefault();
    adicionarTermo();
  });

  $('#produtoForm').on('submit', function(e) {
    e.preventDefault();
    var modelo = obterModeloSelecionado();
    var link = $('#link').val();
    var precoAtual = $('#precoAtual').val();
    var site = obterSiteSelecionado();

    if (!modelo || !link || !precoAtual || !site) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    analisarLink(link, precoAtual);
  });

  $('#modeloSelect').on('change', function() {
    if ($(this).val() === 'Novo item') {
      $('#modeloNovo').show().prop('required', true);
    } else {
      $('#modeloNovo').hide().prop('required', false).val('');
    }
  });

  $('#siteSelect').on('change', function() {
    if ($(this).val() === 'Novo site') {
      $('#siteNovo').show().prop('required', true);
    } else {
      $('#siteNovo').hide().prop('required', false).val('');
    }
  });
});

function carregarListaModelos() {
  console.log('Carregando lista de modelos...');
  chrome.runtime.sendMessage({ action: 'obterListaModelos' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao obter lista de modelos:', chrome.runtime.lastError);
      return;
    }
    if (response.success) {
      const modelos = response.modelos;
      const select = $('#modeloSelect');

      if (!select.length) {
        console.warn('#modeloSelect não encontrado no DOM.');
        return;
      }

      console.log('Limpeza do select e inserção do placeholder inicial em Log');
      select.empty();

      // Adiciona um placeholder que não pode ser selecionado
      select.append(new Option('Selecione um modelo existente ou adicione um novo', '', true, true));
      console.log('Placeholder inserido com sucesso em Log');

      modelos.forEach(m => {
        select.append(new Option(m, m));
        console.log(`Modelo "${m}" adicionado ao select em Log`);
      });
      select.append(new Option('Novo item', 'Novo item'));
      console.log('"Novo item" adicionado ao select em Log');

      select.off('change').on('change', function() {
        console.log('Evento de mudança do select disparado em Log');
        const modeloNovo = $('#modeloNovo');
        if ($(this).val() === 'Novo item') {
          console.log('Selecionado "Novo item", exibindo campo de texto em Log');
          if (modeloNovo.length) {
            modeloNovo.show().prop('required', true);
          }
        } else {
          console.log(`Selecionado modelo existente "${$(this).val()}", escondendo campo de texto em Log`);
          if (modeloNovo.length) {
            modeloNovo.hide().prop('required', false).val('');
          }
        }
      });

      // Garantindo que o campo de texto esteja escondido inicialmente
      const modeloNovo = $('#modeloNovo');
      if (modeloNovo.length) {
        console.log('Escondendo campo de texto do novo modelo em Log');
        modeloNovo.hide().prop('required', false).val('');
      }

      console.log('Lista de modelos carregada e placeholder definido com sucesso em Log');
    } else {
      console.error('Erro ao obter lista de modelos:', response.error);
    }
  });
}

function obterSiteSelecionado() {
  var val = $('#siteSelect').val();
  if (val === 'Novo site') {
    console.log('Checando #novoSite:', $('#novoSite'));
    var novoSiteEl = $('#novoSite');
    if (novoSiteEl.length === 0) {
      console.error('#novoSite não encontrado no DOM em Log');
      return '';
    }
    var novoSiteVal = novoSiteEl.val();
    console.log('Valor de novoSiteVal:', novoSiteVal);
    return novoSiteVal ? novoSiteVal.trim() : '';
  }
  return val;
}

function carregarSites() {
  chrome.runtime.sendMessage({ action: 'obterListaSitesPersonalizados' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao obter lista de sites:', chrome.runtime.lastError);
      return;
    }
    if (response.success) {
      var sites = response.sites;
      var select = $('#siteSelect');
      select.empty();
      // Placeholder não-selecionável e selecionado por padrão
      select.append(new Option('Selecione um site ou adicione um novo', '', true, true));
      sites.forEach(site => {
        select.append(new Option(site, site));
      });
      // Opção "Novo site"
      select.append(new Option('Novo site', 'Novo site'));

      select.on('change', function() {
        if ($(this).val() === 'Novo site') {
          $('#novoSite').show().prop('required', true);
        } else {
          $('#novoSite').hide().prop('required', false).val('');
        }
      });

      // Garantir que o input de novo site esteja oculto inicialmente
      $('#novoSite').hide();
    } else {
      console.error('Erro ao obter lista de sites:', response.error);
    }
  });
}

function enableDarkMode() {
  $('body').addClass('dark-mode');
  localStorage.setItem('darkMode', 'enabled');
}

function disableDarkMode() {
  $('body').removeClass('dark-mode');
  localStorage.setItem('darkMode', 'disabled');
}

function carregarStatus() {
  chrome.storage.local.get(['statusAtual'], function(dados) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao obter status:', chrome.runtime.lastError);
      $('#status').text('Ocioso');
      return;
    }
    $('#status').text(dados.statusAtual || 'Ocioso');
  });
}

function carregarIntervaloTempo() {
  chrome.storage.local.get(['intervaloTempo'], function(dados) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao obter intervalo de tempo:', chrome.runtime.lastError);
      return;
    }
    var intervalo = dados.intervaloTempo || 120;
    $('#intervaloTempo').val(intervalo);
    $('#intervaloAtual').text('Intervalo atual: ' + intervalo + ' minutos');
  });
}

function carregarIntervaloApoiamentos() {
  chrome.storage.local.get(['intervaloApoiamentos'], function(dados) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao obter intervalo de apoiamentos:', chrome.runtime.lastError);
      return;
    }
    var intervalo = dados.intervaloApoiamentos || 60;
    $('#intervaloApoiamentos').val(intervalo);
    $('#intervaloApoiamentosAtual').text('Intervalo atual: ' + intervalo + ' minutos');
  });
}

function formatarPreco(preco) {
  if (!preco || isNaN(parseFloat(preco))) return '<div class="price-cell"><span class="currency-symbol">R$</span><span class="price-value">0,00</span></div>';
  return '<div class="price-cell"><span class="currency-symbol">R$</span><span class="price-value">' +
    parseFloat(preco).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    '</span></div>';
}

function carregarProdutos() {
  console.log('[DEBUG] Iniciando carregarProdutos...');
  chrome.runtime.sendMessage({ action: 'obterProdutosComSites' }, function(response) {
    // 1. Verificar erros de comunicação
    if (chrome.runtime.lastError) {
      console.error('[ERROR] Erro ao carregar produtos:', chrome.runtime.lastError);
      alert('Erro ao carregar produtos: ' + chrome.runtime.lastError.message);
      return;
    }

    // 2. Verificar sucesso/erro na resposta
    if (!response.success) {
      console.error('[ERROR] Erro ao obter produtos mesclados com sites:', response.error);
      alert('Erro ao carregar produtos: ' + response.error);
      return;
    }

    // 3. Se chegou até aqui, temos "response.produtos"
    var produtos = response.produtos;
    console.log('[DEBUG] Lista de produtos mesclados:', produtos);

    // 4. Limpar tabela
    var tbody = $('#tabelaProdutos tbody');
    tbody.empty();

    // 5. Preencher cada linha
    produtos.forEach(function(produto) {
      const tr = $(`<tr data-id="${produto.id}">`);
      tr.html(`
        <td>
          <input type="checkbox" class="produtoAtivoSwitch" data-id="${produto.id}" ${produto.ativo !== false ? 'checked' : ''}>
        </td>
        <td>${produto.modelo}</td>
        <td>${produto.site}</td>
        <td><a href="${produto.link}" target="_blank">Link</a></td>
        <td>${formatarPreco(produto.precoAnterior)}</td>
        <td>${formatarPreco(produto.menorPreco)}</td>
        <td>
          <button class="btn btn-sm btn-primary editarProdutoButton" data-id="${produto.id}">Editar</button>
          <button class="btn btn-sm btn-danger excluirProdutoButton" data-id="${produto.id}">Excluir</button>
        </td>
      `);
      tbody.append(tr);
    });

    // 6. Atribuir eventos
    $('.editarProdutoButton').on('click', function() {
      var id = $(this).data('id');
      editarProduto(id);
    });

    $('.excluirProdutoButton').on('click', function() {
      var id = $(this).data('id');
      excluirProduto(id);
    });

    // 7. Ordenação de tabela, se desejar
    habilitarOrdenacaoTabela('#tabelaProdutos');
  });
}


function analisarLink(link, valorProcurado) {
  console.log('analisarLink chamado com:', link, valorProcurado);

  chrome.runtime.sendMessage({ action: 'analisarLink', link: link, valorProcurado: valorProcurado }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao enviar mensagem para background.js:', chrome.runtime.lastError);
      alert('Erro ao analisar link. Verifique o console para mais detalhes.');
      return;
    }

    console.log('Resposta recebida de background.js:', response);

    if (response.success) {
      const dominio = obterDominioRaiz(new URL(link).hostname);
      if (!dominio) {
        alert('Domínio inválido detectado.');
        return;
      }

      if (response.siteConfig) {
        // Domínio já registrado, usar configuração existente
        const siteConfig = response.siteConfig;
        console.log('[DEBUG] Domínio já registrado. Usando configuração existente:', siteConfig);
        
        salvarProdutoComSeletor(
          siteConfig.cssSelector,
          siteConfig.attribute,
          siteConfig.metodoExtracao
        );
      } else if (response.opcoes && response.opcoes.length > 0) {
        // Domínio não registrado, exibir modal para selecionar seletor
        console.log('[DEBUG] Domínio não registrado. Exibindo modal para selecionar seletor CSS.');
        exibirSeletores(response.opcoes);
      } else {
        console.warn('Nenhuma opção encontrada para selecionar o seletor CSS.');
        alert('Nenhuma opção de seletor CSS encontrada para este link.');
      }
    } else {
      console.error('Erro no processamento de seletores:', response.error || 'Nenhuma opção encontrada.');
      alert('Erro ao analisar link ou nenhum seletor encontrado.');
    }
  });
}


function exibirSeletores(opcoes) {
  ultimasOpcoes = opcoes;
  var tbody = $('#tabelaSeletores tbody');
  tbody.empty();

  if (opcoes.length === 0) {
    tbody.append('<tr><td colspan="4">Nenhum seletor encontrado.</td></tr>');
  } else {
    // Ordenar as opções: atributos antes de texto
    opcoes.sort((a, b) => {
      if (a.metodoExtracao.tipo === 'atributo' && b.metodoExtracao.tipo !== 'atributo') return -1;
      if (a.metodoExtracao.tipo !== 'atributo' && b.metodoExtracao.tipo === 'atributo') return 1;
      return 0;
    });

    opcoes.forEach(function(opcao) {
      var tr = $('<tr>');
      tr.html(`
        <td>${opcao.preview}</td>
        <td>${opcao.selector}</td>
        <td>${opcao.attribute || 'Texto'}</td>
        <td>
          <button class="btn btn-sm btn-success selecionarSeletorButton" data-selector="${opcao.selector}" data-attribute="${opcao.attribute || ''}">Selecionar</button>
        </td>
      `);
      tbody.append(tr);
    });

    $('.selecionarSeletorButton').on('click', function() {
      var selector = $(this).data('selector');
      var attribute = $(this).data('attribute');

      // Recupera a opção completa para obter metodoExtracao
      const opcaoSelecionada = ultimasOpcoes.find(o => o.selector === selector && (o.attribute || '') === (attribute || ''));
      if (!opcaoSelecionada) {
        alert('Opção selecionada não encontrada.');
        return;
      }

      // Agora passamos metodoExtracao também
      salvarProdutoComSeletor(selector, attribute, opcaoSelecionada.metodoExtracao);
      $('#seletorCSSModal').modal('hide');
    });
  }

  $('#seletorCSSModal').modal('show');
}

async function abrirModalSelecao(link) {
  try {
    const response = await fetch(link);
    if (!response.ok) {
      throw new Error('Falha ao carregar página');
    }
    const html = await response.text();
    const frame = document.getElementById('previewFrame');
    frame.srcdoc = html;

    $('#frameSelecaoModal').modal('show');

    frame.onload = () => {
      const doc = frame.contentDocument || frame.contentWindow.document;
      let ultimo = null;

      const mouseover = e => {
        if (ultimo) ultimo.style.outline = '';
        ultimo = e.target;
        e.target.style.outline = '2px solid red';
      };

      const mouseout = e => {
        e.target.style.outline = '';
      };

      const click = e => {
        e.preventDefault();
        e.stopPropagation();
        const selector = getUniqueSelector(e.target);
        $('#frameSelecaoModal').modal('hide');
        salvarProdutoComSeletor(selector, '', { tipo: 'texto' });
        doc.removeEventListener('mouseover', mouseover);
        doc.removeEventListener('mouseout', mouseout);
        doc.removeEventListener('click', click);
      };

      doc.addEventListener('mouseover', mouseover);
      doc.addEventListener('mouseout', mouseout);
      doc.addEventListener('click', click);
    };
  } catch (erro) {
    console.error('Erro ao carregar página para seleção manual:', erro);
    alert('Erro ao carregar página: ' + erro.message);
  }
}

function getUniqueSelector(el) {
  if (el.id) {
    return `#${el.id}`;
  }

  let selector = el.nodeName.toLowerCase();

  if (el.hasAttribute('itemprop')) {
    const itemprop = el.getAttribute('itemprop');
    selector += `[itemprop="${itemprop}"]`;
  } else if (el.hasAttribute('class')) {
    selector += '.' + Array.from(el.classList).join('.');
  }

  const siblings = el.parentNode ? Array.from(el.parentNode.children).filter(child => child.nodeName === el.nodeName) : [];
  if (siblings.length > 1) {
    const index = siblings.indexOf(el) + 1;
    selector += `:nth-of-type(${index})`;
  }

  const path = [selector];
  el = el.parentNode;

  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let part = el.nodeName.toLowerCase();

    if (el.hasAttribute('id')) {
      part += `#${el.getAttribute('id')}`;
    } else if (el.hasAttribute('class')) {
      part += '.' + Array.from(el.classList).join('.');
    }

    const siblingsEl = el.parentNode ? Array.from(el.parentNode.children).filter(child => child.nodeName === el.nodeName) : [];
    if (siblingsEl.length > 1) {
      const indexEl = siblingsEl.indexOf(el) + 1;
      part += `:nth-of-type(${indexEl})`;
    }

    path.unshift(part);
    el = el.parentNode;
  }

  return path.join(' > ');
}

function obterModeloSelecionado() {
  var val = $('#modeloSelect').val();
  if (val === 'Novo item') {
    return $('#modeloNovo').val().trim();
  }
  return val;
}

async function salvarProdutoComSeletor(selector, attribute, metodoExtracao) {
  const modelo = obterModeloSelecionado();
  const link = $('#link').val();
  const precoAtualInput = $('#precoAtual').val(); // Obter o preço atual
  const siteNome = obterSiteSelecionado();

  if (!modelo || !link || !selector || !precoAtualInput) {
    alert('Por favor, preencha todos os campos obrigatórios, incluindo o preço atual.');
    return;
  }

  const precoAtual = parseFloat(precoAtualInput.replace(',', '.'));
  if (isNaN(precoAtual)) {
    alert('Por favor, insira um valor válido para o preço atual.');
    return;
  }

  let dominioCompleto;
  try {
    const url = new URL(link);
    dominioCompleto = url.hostname;
  } catch (erro) {
    alert('Link inválido. Por favor, insira uma URL válida.');
    return;
  }

  const dominio = obterDominioRaiz(dominioCompleto);
  
  if (!dominio) {
    alert('Domínio inválido detectado. Por favor, verifique o link do produto.');
    return;
  }
  
  console.log('[DEBUG] Dominio extraído em salvarProdutoComSeletor:', dominio);

  const produto = {
    modelo: modelo,
    link: link,
    site: siteNome,
    cssSelector: selector,
    attribute: attribute || 'innerText',
    ativo: true,
    precoAnterior: precoAtual.toString(),
    menorPreco: precoAtual.toString(),
    metodoExtracao: metodoExtracao // Incluindo método de extração selecionado
  };

  // Grava a configuração do site no banco
  const siteConfig = {
    dominio: dominio,
    cssSelector: selector,
    attribute: attribute || 'innerText',
    metodoExtracao: metodoExtracao
  };

  console.log('[DEBUG] SiteConfig antes de adicionarOuAtualizarSite:', siteConfig);

  try {
    // Adicionar ou atualizar a configuração do site
    $('#analisarLinkButton').prop('disabled', true).text('Salvando...');
		const siteResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'adicionarOuAtualizarSite', site: siteConfig }, function(response) {
        resolve(response);
      });
    });

    if (!siteResponse.success) {
      alert('Erro ao salvar configuração do site: ' + siteResponse.error);
			$('#analisarLinkButton').prop('disabled', false).text('Analisar Link');
      return;
    }

    // Adicionar o produto
    const produtoResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'adicionarProduto', produto: produto }, function(response) {
        resolve(response);
      });
    });

    if (produtoResponse.success) {
      alert('Produto salvo com sucesso!');
      $('#produtoForm')[0].reset(); // Limpa o formulário após salvar

      // Atualizar as listas de produtos e sites
      await carregarProdutos();
      await carregarSites(); // Se houver uma função para carregar sites

      // Atualizar a lista de modelos, se aplicável
      await carregarListaModelos(); // Implementar se necessário
			$('#analisarLinkButton').prop('disabled', false).text('Analisar Link');
    } else {
      alert('Erro ao salvar produto: ' + produtoResponse.error);
			$('#analisarLinkButton').prop('disabled', false).text('Analisar Link');
    }
  } catch (erro) {
    console.error('Erro ao salvar produto:', erro);
    alert('Erro ao salvar produto: ' + erro.message);
		$('#analisarLinkButton').prop('disabled', false).text('Analisar Link');
  }
}

function editarProduto(id) {
  // Solicita os dados do produto pelo ID
  chrome.runtime.sendMessage({ action: 'obterProdutoPorId', id: id }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao obter produto:', chrome.runtime.lastError);
      alert('Erro ao obter produto. Verifique o console para mais detalhes.');
      return;
    }

    if (response.success) {
      var produto = response.produto;

      // Preenche os campos com os dados do produto
      $('#editarProdutoId').val(produto.id);
      $('#editarSite').val(produto.site);
      $('#editarLink').val(produto.link);
      $('#editarPrecoAnterior').val(produto.precoAnterior);
      $('#editarMenorPreco').val(produto.menorPreco);
      $('#editarAtivo').prop('checked', produto.ativo !== false);

      // Carrega a lista de modelos e seleciona o modelo atual
      chrome.runtime.sendMessage({ action: 'obterListaModelos' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Erro ao obter lista de modelos:', chrome.runtime.lastError);
          alert('Erro ao carregar lista de modelos. Verifique o console para mais detalhes.');
          return;
        }

        if (response.success) {
          const modelos = response.modelos || [];
          const select = $('#editarModelo');
          select.empty();

          // Adiciona os modelos existentes
          modelos.forEach(m => {
            const option = new Option(m, m, false, m === produto.modelo);
            select.append(option);
          });

          // Adiciona a opção "Novo item"
          select.append(new Option('Novo item', 'Novo item'));

          // Configura exibição do campo de texto para novos modelos
          select.off('change').on('change', function() {
            if ($(this).val() === 'Novo item') {
              $('#editarModeloNovo').show().prop('required', true);
            } else {
              $('#editarModeloNovo').hide().prop('required', false).val('');
            }
          });

          // Seleciona o modelo do produto
          select.val(produto.modelo);
          $('#editarModeloNovo').hide();
        } else {
          console.error('Erro ao carregar lista de modelos:', response.error);
        }
      });

      // Abre o modal de edição do produto
      $('#editarProdutoModal').modal('show');
    } else {
      alert('Erro ao obter produto: ' + response.error);
    }
  });
}


function salvarEdicaoProduto() {
  var id = $('#editarProdutoId').val();
  var modelo = $('#editarModelo').val();
  var link = $('#editarLink').val();
  var precoAnterior = $('#editarPrecoAnterior').val();
  var menorPreco = $('#editarMenorPreco').val();
  var ativo = $('#editarAtivo').is(':checked');

  var site = $('#editarSite').val(); // obtém o site selecionado no modal de edição

	var produtoAtualizado = {
		id: parseInt(id),
		modelo: modelo,
		link: link,
		site: site, // incluir o site
		precoAnterior: precoAnterior,
		menorPreco: menorPreco,
		ativo: ativo
	};


  chrome.runtime.sendMessage({ action: 'atualizarProduto', produto: produtoAtualizado }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao atualizar produto:', chrome.runtime.lastError);
      alert('Erro ao atualizar produto. Verifique o console para mais detalhes.');
      return;
    }
    if (response.success) {
      alert('Produto atualizado com sucesso!');
      $('#editarProdutoModal').modal('hide');
      carregarProdutos();
			carregarListaModelos();
      carregarSites();
    } else {
      alert('Erro ao atualizar produto: ' + response.error);
    }
  });
}

function excluirProduto(id) {
  if (confirm('Tem certeza que deseja excluir este produto?')) {
    chrome.runtime.sendMessage({ action: 'excluirProduto', id: id }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Erro ao excluir produto:', chrome.runtime.lastError);
        alert('Erro ao excluir produto. Verifique o console para mais detalhes.');
        return;
      }
      if (response.success) {
        alert('Produto excluído com sucesso!');
        carregarProdutos();
				carregarListaModelos();
        carregarSites();
      } else {
        alert('Erro ao excluir produto: ' + response.error);
      }
    });
  }
}

function carregarTermos() {
  chrome.runtime.sendMessage({ action: 'obterTermos' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao carregar termos:', chrome.runtime.lastError);
      alert('Erro ao carregar termos: ' + chrome.runtime.lastError.message);
      return;
    }
    if (response.success) {
      var termos = response.termos;
      var tbody = $('#tabelaTermos tbody');
      tbody.empty();

      termos.forEach(function(termo) {
        var tr = $('<tr>');
        tr.html(`
          <td>
            <input type="checkbox" class="termoAtivoSwitch" data-id="${termo.id}" ${termo.ativo !== false ? 'checked' : ''}>
          </td>
          <td>${termo.descricao}</td>
          <td><a href="${termo.link}" target="_blank">Link</a></td>
          <td>${termo.termo}</td>
          <td>
            <button class="btn btn-sm btn-primary editarTermoButton" data-id="${termo.id}">Editar</button>
            <button class="btn btn-sm btn-danger excluirTermoButton" data-id="${termo.id}">Excluir</button>
          </td>
        `);
        tbody.append(tr);
      });

      $('.editarTermoButton').on('click', function() {
        var id = $(this).data('id');
        editarTermo(id);
      });

      $('.excluirTermoButton').on('click', function() {
        var id = $(this).data('id');
        excluirTermo(id);
      });

      habilitarOrdenacaoTabela('#tabelaTermos');
    } else {
      console.error('Erro ao obter termos:', response.error);
      alert('Erro ao carregar termos: ' + response.error);
    }
  });
}

function adicionarTermo() {
  var descricao = $('#descricaoTermo').val();
  var link = $('#linkTermo').val();
  var termo = $('#termo').val();

  if (!descricao || !link || !termo) {
    alert('Por favor, preencha todos os campos do termo.');
    return;
  }

  var novoTermo = {
    descricao: descricao,
    link: link,
    termo: termo,
    ativo: true
  };

  chrome.runtime.sendMessage({ action: 'adicionarTermo', termo: novoTermo }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao adicionar termo:', chrome.runtime.lastError);
      alert('Erro ao adicionar termo. Verifique o console para mais detalhes.');
      return;
    }
    if (response.success) {
      alert('Termo adicionado com sucesso!');
      $('#termoForm')[0].reset();
      carregarTermos();
    } else {
      alert('Erro ao adicionar termo: ' + response.error);
    }
  });
}

function editarTermo(id) {
  chrome.runtime.sendMessage({ action: 'obterTermoPorId', id: id }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao obter termo:', chrome.runtime.lastError);
      alert('Erro ao obter termo. Verifique o console para mais detalhes.');
      return;
    }
    if (response.success) {
      var termo = response.termo;
      $('#editarTermoId').val(termo.id);
      $('#editarDescricaoTermo').val(termo.descricao);
      $('#editarLinkTermo').val(termo.link);
      $('#editarTermo').val(termo.termo);
      $('#editarAtivoTermo').prop('checked', termo.ativo !== false);
      $('#editarTermoModal').modal('show');
    } else {
      alert('Erro ao obter termo: ' + response.error);
    }
  });
}

function salvarEdicaoTermo() {
  var id = $('#editarTermoId').val();
  var descricao = $('#editarDescricaoTermo').val();
  var link = $('#editarLinkTermo').val();
  var termo = $('#editarTermo').val();
  var ativo = $('#editarAtivoTermo').is(':checked');

  var termoAtualizado = {
    id: parseInt(id),
    descricao: descricao,
    link: link,
    termo: termo,
    ativo: ativo
  };

  chrome.runtime.sendMessage({ action: 'atualizarTermo', termo: termoAtualizado }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao atualizar termo:', chrome.runtime.lastError);
      alert('Erro ao atualizar termo. Verifique o console para mais detalhes.');
      return;
    }
    if (response.success) {
      alert('Termo atualizado com sucesso!');
      $('#editarTermoModal').modal('hide');
      carregarTermos();
    } else {
      alert('Erro ao atualizar termo: ' + response.error);
    }
  });
}

function excluirTermo(id) {
  if (confirm('Tem certeza que deseja excluir este termo?')) {
    chrome.runtime.sendMessage({ action: 'excluirTermo', id: id }, function(response) {
      if (chrome.runtime.lastError) {
        console.error('Erro ao excluir termo:', chrome.runtime.lastError);
        alert('Erro ao excluir termo. Verifique o console para mais detalhes.');
        return;
      }
      if (response.success) {
        alert('Termo excluído com sucesso!');
        carregarTermos();
      } else {
        alert('Erro ao excluir termo: ' + response.error);
      }
    });
  }
}

function salvarConfiguracoesTelegram() {
  var botToken = $('#botToken').val();
  var chatId = $('#chatId').val();

  if (!botToken || !chatId) {
    alert('Por favor, preencha todos os campos do Telegram.');
    return;
  }

  chrome.runtime.sendMessage({ action: 'salvarConfiguracoesTelegram', botToken: botToken, chatId: chatId }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao salvar configurações do Telegram:', chrome.runtime.lastError);
      alert('Erro ao salvar configurações do Telegram. Verifique o console para mais detalhes.');
      return;
    }
    if (response.success) {
      alert('Configurações do Telegram salvas com sucesso!');
    } else {
      alert('Erro ao salvar configurações do Telegram: ' + response.error);
    }
  });
}

function carregarConfiguracoesTelegram() {
  chrome.runtime.sendMessage({ action: 'obterConfiguracoesTelegram' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao carregar configurações do Telegram:', chrome.runtime.lastError);
      alert('Erro ao carregar configurações do Telegram: ' + chrome.runtime.lastError.message);
      return;
    }
    if (response.success) {
      var dados = response.configuracoes;
      if (dados.botToken) {
        $('#botToken').val(dados.botToken);
      }
      if (dados.chatId) {
        $('#chatId').val(dados.chatId);
      }
    } else {
      alert('Erro ao carregar configurações do Telegram: ' + response.error);
    }
  });
}

function definirIntervaloTempo() {
  var intervaloTempo = $('#intervaloTempo').val();
  if (!intervaloTempo || intervaloTempo <= 0) {
    alert('Por favor, insira um intervalo válido em minutos.');
    return;
  }

  chrome.runtime.sendMessage({ action: 'definirIntervaloTempo', intervaloTempo: intervaloTempo }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao definir intervalo de tempo:', chrome.runtime.lastError);
      alert('Erro ao salvar intervalo de tempo. Verifique o console para mais detalhes.');
      return;
    }
    if (response.success) {
      alert('Intervalo salvo com sucesso!');
      $('#intervaloAtual').text('Intervalo atual: ' + intervaloTempo + ' minutos');
    } else {
      alert('Erro ao salvar intervalo: ' + response.error);
    }
  });
}

function definirIntervaloApoiamentos() {
  var intervalo = $('#intervaloApoiamentos').val();
  if (!intervalo || intervalo <= 0) {
    alert('Por favor, insira um intervalo válido em minutos.');
    return;
  }

  chrome.runtime.sendMessage({ action: 'definirIntervaloApoiamentos', intervaloTempo: intervalo }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao definir intervalo de apoiamentos:', chrome.runtime.lastError);
      alert('Erro ao salvar intervalo de apoiamentos. Verifique o console para mais detalhes.');
      return;
    }
    if (response.success) {
      alert('Intervalo salvo com sucesso!');
      $('#intervaloApoiamentosAtual').text('Intervalo atual: ' + intervalo + ' minutos');
    } else {
      alert('Erro ao salvar intervalo: ' + response.error);
    }
  });
}

function carregarLogs() {
  chrome.runtime.sendMessage({ action: 'obterLogs' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('Erro ao carregar logs:', chrome.runtime.lastError);
      alert('Erro ao carregar logs: ' + chrome.runtime.lastError.message);
      return;
    }
    if (response.success) {
      var logs = response.logs;
      var tbody = $('#tabelaLogs tbody');
      tbody.empty();

      logs.sort(function(a, b) {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      logs.forEach(function(log) {
        adicionarLogNaTabela(log);
      });
	  
      habilitarOrdenacaoTabela('#tabelaLogs');
    } else {
      alert('Erro ao carregar logs: ' + response.error);
    }
  });
}

function alterarCorLinhaProduto(id, encontrado) {
  const linha = $(`#tabelaProdutos tbody tr[data-id="${id}"]`);
  if (!linha.length) return; // Verifica se a linha existe

  if (encontrado) {
    // Voltar à cor normal
    linha.css('color', '');
  } else {
    // Alterar para a cor específica de acordo com o modo
    const corErro = $('body').hasClass('dark-mode') ? '#FFF212' : '#FF0000';
    linha.css('color', corErro);
  }
}

function adicionarLogNaTabela(log) {
  var tbody = $('#tabelaLogs tbody');
  var tr = $('<tr>');
  tr.html(`
    <td>${formatarDataHora(log.timestamp)}</td>
    <td>${log.mensagem}</td>
  `);
  tbody.prepend(tr);
}

function extrairValorMonetario(texto) {
  if (!texto) return null;

  // Remover qualquer caractere que não seja dígito, ponto ou vírgula
  texto = texto.replace(/[^\d.,-]/g, '');

  // Trocar vírgula por ponto para normalizar o formato decimal
  texto = texto.replace(',', '.');

  // Remover todos os pontos que não sejam decimais (assume-se que sejam separadores de milhar)
  texto = texto.replace(/(?<=\d)\.(?=\d{3}(\.|$))/g, '');

  const valor = parseFloat(texto);
  return isNaN(valor) ? null : valor;
}

function formatarDataHora(timestamp) {
  var data = new Date(timestamp);
  var dia = String(data.getDate()).padStart(2, '0');
  var mes = String(data.getMonth() + 1).padStart(2, '0');
  var ano = data.getFullYear();
  var horas = String(data.getHours()).padStart(2, '0');
  var minutos = String(data.getMinutes()).padStart(2, '0');
  var segundos = String(data.getSeconds()).padStart(2, '0');
  var milissegundos = String(data.getMilliseconds()).padStart(3, '0');

  return `[${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}.${milissegundos}]`;
}
// Função genérica para habilitar ordenação nas tabelas
function habilitarOrdenacaoTabela(tabelaSeletor) {
  const tabela = $(tabelaSeletor);
  const ths = tabela.find('th');
  ths.each(function(index) {
    $(this).on('click', function() {
      const rows = tabela.find('tbody tr').get();
      const isAsc = $(this).data('asc') === undefined ? true : !$(this).data('asc');
      $(this).data('asc', isAsc);

      rows.sort((a, b) => {
				const tdA = $(a).children('td').eq(index).text().trim();
				const tdB = $(b).children('td').eq(index).text().trim();

				// Converter valores de texto em números, considerando moeda
				const valorA = extrairValorMonetario(tdA);
				const valorB = extrairValorMonetario(tdB);

				if (valorA !== null && valorB !== null) {
					// Ordenar como números
					return (valorA - valorB) * (isAsc ? 1 : -1);
				} else {
					// Ordenar como strings caso não sejam números válidos
					return tdA.localeCompare(tdB) * (isAsc ? 1 : -1);
				}
			});



      $.each(rows, function(i, row) {
        tabela.find('tbody').append(row);
      });
    });
  });
}

// Exibir/Ocultar campo CSV e gerar CSV ao exibir
$('#toggleCampoCsv').on('click', async function() {
  console.log('[LOG] Botão toggleCampoCsv acionado.');
  $('#campoCsvContainer').toggle();

  if ($('#campoCsvContainer').is(':visible')) {
    console.log('[LOG] Campo CSV está visível, gerando CSV...');
    try {
      // 1. Obter lista de produtos
      const respostaProdutos = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'obterProdutos' }, resolve);
      });

      if (!respostaProdutos.success) {
        alert('Erro ao obter produtos: ' + respostaProdutos.error);
        return;
      }

      const listaProdutos = respostaProdutos.produtos;
      
      // 2. Definir cabeçalho do CSV (10 colunas):
      // Modelo;Site;Link;Seletor CSS;Atributo;Metodo Extracao Tipo;Metodo Extracao Atributo;Ativo;Preco Anterior;Menor Preco
      let csv = "Modelo;Site;Link;Seletor CSS;Atributo;Metodo Extracao Tipo;Metodo Extracao Atributo;Ativo;Preco Anterior;Menor Preco\n";

      // 3. Percorrer cada produto e buscar config atualizada no store "sites"
      for (const produto of listaProdutos) {
        // Extrair domínio raiz do link do produto
        if (!produto.link) {
          console.warn(`[WARN] Produto "${produto.modelo}" sem link. Pulando...`);
          continue;
        }

        let dominioTemp;
        try {
          const urlObj = new URL(produto.link);
          dominioTemp = urlObj.hostname.replace(/^www\./, '');
        } catch (err) {
          console.warn(`[WARN] Link inválido no produto "${produto.modelo}": ${produto.link}. Pulando...`);
          continue;
        }

        const dominioRaiz = obterDominioRaiz(dominioTemp);
        if (!dominioRaiz) {
          console.warn(`[WARN] Domínio inválido extraído para "${produto.modelo}": ${produto.link}. Pulando...`);
          continue;
        }

        // Buscar config atual do store 'sites'
        const respostaSite = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'obterSitePorDominio', dominio: dominioRaiz },
            (resp) => { resolve(resp); }
          );
        });

        // Valores locais do produto
        let cssSelector = produto.cssSelector || '';
        let attribute = produto.attribute || '';
        let metodoTipo = (produto.metodoExtracao && produto.metodoExtracao.tipo) || '';
        let metodoAttr = (produto.metodoExtracao && produto.metodoExtracao.nomeAttr) || '';

        // Se encontrou config de domínio, sobrescreve valores do produto
        if (respostaSite.success && respostaSite.site) {
          const siteConfig = respostaSite.site;
          cssSelector = siteConfig.cssSelector || cssSelector;
          attribute = siteConfig.attribute || attribute;
          if (siteConfig.metodoExtracao) {
            metodoTipo = siteConfig.metodoExtracao.tipo || metodoTipo;
            metodoAttr = siteConfig.metodoExtracao.nomeAttr || metodoAttr;
          }
        }

        // Convertendo booleano ou undefined para texto “true”/“false”
        const valorAtivo = (produto.ativo === false) ? 'false' : 'true';
        const valorPrecoAnterior = produto.precoAnterior || '';
        const valorMenorPreco = produto.menorPreco || '';

        // 4. Montar linha CSV final (com a config atualizada)
        csv += (
          `${produto.modelo};` +
          `${produto.site || ''};` +
          `${produto.link || ''};` +
          `${cssSelector};` +
          `${attribute};` +
          `${metodoTipo};` +
          `${metodoAttr};` +
          `${valorAtivo};` +
          `${valorPrecoAnterior};` +
          `${valorMenorPreco}\n`
        );
      }

      // 5. Inserir o CSV pronto no textarea
      $('#campoCsv').val(csv.trim());
      console.log('[LOG] CSV gerado com sucesso. Linhas:', listaProdutos.length);

    } catch (erro) {
      console.error('[ERROR] Erro ao gerar CSV:', erro);
      alert('Erro ao gerar CSV. Verifique o console para mais detalhes.');
    }
  }
});


// Função para exportar conteúdo CSV (apenas copia o conteúdo já gerado)
$('#botaoExportar').on('click', function() {
  const csvContent = $('#campoCsv').val().trim();
  if (!csvContent) {
    alert('O campo CSV está vazio ou não está visível.');
    return;
  }
  navigator.clipboard.writeText(csvContent);
  alert('Conteúdo copiado para a área de transferência!');
});

// Função para importar conteúdo CSV
// options.js

$('#botaoImportar').on('click', function() {
  console.log('[LOG] Botão Importar acionado.');
  const conteudoCsv = $('#campoCsv').val().trim();
  
  if (!conteudoCsv) {
    alert('O campo CSV está vazio.');
    return;
  }

  // Novo cabeçalho esperado (10 colunas):
  // Modelo;Site;Link;Seletor CSS;Atributo;Metodo Extracao Tipo;Metodo Extracao Atributo;Ativo;Preco Anterior;Menor Preco
  const linhas = conteudoCsv.split('\n').slice(1); // Ignora a linha de cabeçalho

  // Gera array de produtos a partir das linhas
  const produtos = linhas.map(linha => {
    const campos = linha.split(';').map(c => c.trim());
    // Desestruturar 10 colunas
    const [
      modelo, 
      site, 
      link, 
      cssSelector, 
      attribute, 
      metodoTipo, 
      metodoAttr, 
      ativoStr, 
      precoAnteriorStr, 
      menorPrecoStr
    ] = campos;

    // Converte "true" / "false" para boolean
    const boolAtivo = (ativoStr === 'false') ? false : true;

    return {
      modelo: modelo || '',
      site: site || '',
      link: link || '',
      cssSelector: cssSelector || '',
      attribute: attribute || '',
      ativo: boolAtivo,
      precoAnterior: precoAnteriorStr || '',
      menorPreco: menorPrecoStr || '',
      metodoExtracao: {
        tipo: metodoTipo || '',
        nomeAttr: metodoAttr || ''
      }
    };
  });

  // Importar cada produto no IndexedDB
  (async () => {
    console.log('[LOG] Iniciando loop de importação. Total de linhas:', produtos.length);

    for (const produto of produtos) {
      // Extrair domínio para criar siteConfig, caso ainda não exista
      let dominioCompleto;
      try {
        const url = new URL(produto.link);
        dominioCompleto = url.hostname.replace('www.', '');
      } catch (erro) {
        console.warn(`[WARN] Link inválido para o produto "${produto.modelo}": ${produto.link}. Produto ignorado.`);
        continue;
      }

      const dominio = obterDominioRaiz(dominioCompleto);
      if (!dominio) {
        console.warn(`[WARN] Domínio inválido detectado para o link: ${produto.link}. Produto ignorado.`);
        continue;
      }

      // Monta siteConfig
      const siteConfig = {
        dominio: dominio,
        cssSelector: produto.cssSelector,
        attribute: produto.attribute,
        metodoExtracao: produto.metodoExtracao
      };

      // Adicionar ou atualizar o site no banco
      try {
        const respostaSite = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'adicionarOuAtualizarSite', site: siteConfig },
            function(response) { resolve(response); }
          );
        });
        if (!respostaSite.success) {
          console.error(`[ERROR] Falha ao adicionar/atualizar site para domínio "${dominio}":`, respostaSite.error);
          continue;
        }
      } catch (erroSite) {
        console.error(`[ERROR] Erro ao adicionar/atualizar site para domínio "${dominio}":`, erroSite);
        continue;
      }

      // Adicionar o produto
      try {
        const respostaProduto = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'adicionarProduto', produto: produto },
            function(resp) { resolve(resp); }
          );
        });
        if (!respostaProduto.success) {
          console.error(`[ERROR] Falha ao adicionar produto "${produto.modelo}":`, respostaProduto.error);
        } else {
          console.log(`[LOG] Produto "${produto.modelo}" importado com sucesso.`);
        }
      } catch (erroProd) {
        console.error(`[ERROR] Erro ao adicionar produto "${produto.modelo}":`, erroProd);
      }
    }

    alert('Importação concluída com sucesso!');
    carregarProdutos();
    carregarSites(); 
  })();
});