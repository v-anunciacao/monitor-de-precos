// background.js

function formatarBRL(valorNumerico) {
  return valorNumerico.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function obterDominioRaiz(hostname) {
  console.log('[DEBUG] obterDominioRaiz chamado com:', hostname);
  
  // Remove "www." do início, se existir
  hostname = hostname.replace(/^www\./, '');
  console.log('[DEBUG] Após remover www:', hostname);

  const partes = hostname.split('.');
  console.log('[DEBUG] Partes do hostname:', partes);

  // Lista de TLDs compostos conhecidos
  const tldsCompostos = ['com.br', 'co.uk', 'org.br', 'gov.br'];

  for (const tld of tldsCompostos) {
    if (hostname.endsWith(tld)) {
      console.log('[DEBUG] TLD composto detectado:', tld);
      const partesTLD = tld.split('.');
      const numPartesTLD = partesTLD.length;
      const numPartesHostname = partes.length;
      const dominio = partes.slice(numPartesHostname - numPartesTLD - 1).join('.');
      console.log('[DEBUG] Dominio raiz extraído (TLD composto):', dominio);
      return dominio;
    }
  }

  if (partes.length > 2) {
    const dominio = partes.slice(-2).join('.');
    console.log('[DEBUG] Dominio raiz extraído (múltiplas partes):', dominio);
    return dominio;
  }

  console.log('[DEBUG] Dominio raiz (caso simples):', hostname);
  return hostname;
}

if (typeof chrome === 'undefined' || typeof chrome.runtime === 'undefined' || typeof indexedDB === 'undefined') {
  console.error('As APIs do Chrome não estão disponíveis. Certifique-se de que a extensão está sendo executada no contexto correto.');
} else {
  const DB_NAME = 'MonitorDePrecosDB';
  const DB_VERSION = 1;
  let intervaloVerificacao = 120;

  function inicializarBancoDados() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function(event) {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('produtos')) {
					const produtosStore = db.createObjectStore('produtos', { keyPath: 'id', autoIncrement: true });
					produtosStore.createIndex('ativo', 'ativo', { unique: false });
					produtosStore.createIndex('modelo', 'modelo', { unique: false });
					produtosStore.createIndex('cssSelector', 'cssSelector', { unique: false }); // Novo campo
					produtosStore.createIndex('attribute', 'attribute', { unique: false }); // Novo campo
        }

        if (!db.objectStoreNames.contains('termos')) {
          const termosStore = db.createObjectStore('termos', { keyPath: 'id', autoIncrement: true });
          termosStore.createIndex('ativo', 'ativo', { unique: false });
          termosStore.createIndex('descricao', 'descricao', { unique: false });
        }

        if (!db.objectStoreNames.contains('sites')) {
          const sitesStore = db.createObjectStore('sites', { keyPath: 'id', autoIncrement: true });
          sitesStore.createIndex('dominio', 'dominio', { unique: true });
        }

        if (!db.objectStoreNames.contains('logs')) {
          const logsStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
          logsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('historicoPrecos')) {
          const historicoStore = db.createObjectStore('historicoPrecos', { keyPath: 'id', autoIncrement: true });
          historicoStore.createIndex('produtoId', 'produtoId', { unique: false });
          historicoStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = function(event) {
        const db = event.target.result;
        resolve(db);
      };

      request.onerror = function(event) {
        console.error('Erro ao abrir o banco de dados:', event.target.errorCode);
        reject(`Erro ao abrir o banco de dados: ${event.target.errorCode}`);
      };
    });
  }

  async function adicionarLog(db, mensagem) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['logs'], 'readwrite');
      const logsStore = transaction.objectStore('logs');
      const log = {
        timestamp: new Date().toISOString(),
        mensagem: mensagem
      };
      const request = logsStore.add(log);

      request.onsuccess = function() {
        resolve(true);
      };

      request.onerror = function(event) {
        console.error('Erro ao adicionar log:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function limparLogsAntigos(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['logs'], 'readwrite');
      const logsStore = transaction.objectStore('logs');
      const countRequest = logsStore.count();

      countRequest.onsuccess = function() {
        const count = countRequest.result;
        if (count > 100) {
          const excess = count - 100;
          const cursorRequest = logsStore.openCursor();
          let deletados = 0;

          cursorRequest.onsuccess = function(event) {
            const cursor = event.target.result;
            if (cursor && deletados < excess) {
              cursor.delete();
              deletados++;
              cursor.continue();
            } else {
              resolve(true);
            }
          };

          cursorRequest.onerror = function(event) {
            console.error('Erro ao limpar logs antigos:', event.target.error);
            reject(event.target.error);
          };
        } else {
          resolve(true);
        }
      };

      countRequest.onerror = function(event) {
        console.error('Erro ao contar logs:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function excluirTodosLogs(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['logs'], 'readwrite');
      const logsStore = transaction.objectStore('logs');
      const request = logsStore.clear();

      request.onsuccess = function() {
        resolve(true);
      };
      request.onerror = function(event) {
        reject(event.target.error);
      };
    });
  }

	async function obterTodosProdutos(db) {
			return new Promise((resolve, reject) => {
				const transaction = db.transaction(['produtos'], 'readonly');
				const produtosStore = transaction.objectStore('produtos');
				const request = produtosStore.getAll();

				request.onsuccess = function(event) {
					resolve(event.target.result);
				};

				request.onerror = function(event) {
					console.error('Erro ao obter produtos:', event.target.error);
					reject(event.target.error);
				};
			});
		}
	
	async function adicionarProduto(db, produto) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['produtos'], 'readwrite');
			const produtosStore = transaction.objectStore('produtos');
			const request = produtosStore.add(produto);

			request.onsuccess = async function(event) {
				// Obter o ID do produto recém-adicionado
				const id = event.target.result;
				// Atribuir o ID ao objeto produto
				produto.id = id;
				
				const url = new URL(produto.link);
				const dominio = obterDominioRaiz(url.hostname.replace('www.', ''));

				// Verificar se já existe uma configuração para o domínio
				const configExistente = await obterConfiguracaoPorDominio(db, dominio);

				if (!configExistente) {
					const siteConfig = {
						dominio: dominio,
						cssSelector: produto.cssSelector,
						attribute: produto.attribute || 'innerText',
						metodoExtracao: produto.metodoExtracao
					};
					try {
						await adicionarOuAtualizarSite(db, siteConfig);
					} catch (erro) {
						console.error('Erro ao adicionar configuração do site:', erro);
						// Continua mesmo assim
					}
				}

				// Buscar o preço atual utilizando os seletores
				const precoAtual = await buscarPrecoProduto(produto.link, produto.cssSelector, produto.attribute);
				
				if (precoAtual !== null) {
					produto.precoAnterior = precoAtual.toString();
					produto.menorPreco = precoAtual.toString();
					try {
						await atualizarProduto(db, produto); // Atualiza o produto com o preço atual
						await adicionarLog(db, `Produto atualizado após importação: ${produto.modelo} com precoAnterior = ${produto.precoAnterior}`);
						// Recalcular o menorPreco após atualizar o produto
						await recalcularMenorPrecoModelo(db, produto.modelo);
						resolve(true);
					} catch (erro) {
						console.error('Erro ao atualizar produto após importação:', erro);
						reject(erro);
					}
				} else {
					console.warn(`Não foi possível extrair precoAtual para o produto ${produto.modelo} durante a importação.`);
					// Opcional: definir precoAnterior e menorPreco como null ou um valor padrão
					produto.precoAnterior = null;
					produto.menorPreco = null;
					try {
						await atualizarProduto(db, produto);
						await adicionarLog(db, `Produto importado sem precoAtual: ${produto.modelo}`);
						resolve(true);
					} catch (erro) {
						console.error('Erro ao atualizar produto sem precoAtual após importação:', erro);
						reject(erro);
					}
				}
			};

			request.onerror = function(event) {
				console.error('Erro ao adicionar produto:', event.target.error);
				reject(event.target.error);
			};
		});
	}

	async function atualizarProduto(db, produtoAtualizado) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['produtos'], 'readwrite');
			const produtosStore = transaction.objectStore('produtos');
			const request = produtosStore.put(produtoAtualizado);

			request.onsuccess = function() {
				resolve(true);
			};

			request.onerror = function(event) {
				console.error('Erro ao atualizar produto:', event.target.error);
				reject(event.target.error);
			};
		});
	}

  async function obterProdutoPorId(db, id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['produtos'], 'readonly');
      const produtosStore = transaction.objectStore('produtos');
      const request = produtosStore.get(id);

      request.onsuccess = function(event) {
        resolve(event.target.result);
      };

      request.onerror = function(event) {
        console.error('Erro ao obter produto por ID:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function excluirProduto(db, id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['produtos'], 'readwrite');
      const produtosStore = transaction.objectStore('produtos');
      const request = produtosStore.delete(id);

      request.onsuccess = function() {
        resolve(true);
      };

      request.onerror = function(event) {
        console.error('Erro ao excluir produto:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function obterTodosTermos(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['termos'], 'readonly');
      const termosStore = transaction.objectStore('termos');
      const request = termosStore.getAll();

      request.onsuccess = function(event) {
        resolve(event.target.result);
      };

      request.onerror = function(event) {
        console.error('Erro ao obter termos:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function adicionarTermo(db, termo) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['termos'], 'readwrite');
      const termosStore = transaction.objectStore('termos');
      const request = termosStore.add(termo);

      request.onsuccess = function() {
        resolve(true);
      };

      request.onerror = function(event) {
        console.error('Erro ao adicionar termo:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function atualizarTermo(db, termoAtualizado) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['termos'], 'readwrite');
      const termosStore = transaction.objectStore('termos');
      const request = termosStore.put(termoAtualizado);

      request.onsuccess = function() {
        resolve(true);
      };

      request.onerror = function(event) {
        console.error('Erro ao atualizar termo:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function obterTermoPorId(db, id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['termos'], 'readonly');
      const termosStore = transaction.objectStore('termos');
      const request = termosStore.get(id);

      request.onsuccess = function(event) {
        resolve(event.target.result);
      };

      request.onerror = function(event) {
        console.error('Erro ao obter termo por ID:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function excluirTermo(db, id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['termos'], 'readwrite');
      const termosStore = transaction.objectStore('termos');
      const request = termosStore.delete(id);

      request.onsuccess = function() {
        resolve(true);
      };

      request.onerror = function(event) {
        console.error('Erro ao excluir termo:', event.target.error);
        reject(event.target.error);
      };
    });
  }

	async function adicionarOuAtualizarSite(db, site) {
		console.log('[DEBUG] adicionarOuAtualizarSite chamado com site:', site);
		
		// Validação do domínio antes de salvar
		if (!validarDominio(site.dominio)) {
			console.error('[ERROR] Domínio inválido detectado:', site.dominio);
			return { success: false, error: 'Domínio inválido.' };
		}

		// Validação dos campos necessários
		if (!site.cssSelector || !site.attribute || !site.metodoExtracao || !site.metodoExtracao.tipo) {
			console.error('[ERROR] Configuração do site incompleta:', site);
			return { success: false, error: 'Configuração do site incompleta.' };
		}

		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['sites'], 'readwrite');
			const sitesStore = transaction.objectStore('sites');
			const index = sitesStore.index('dominio');
			const request = index.get(site.dominio);

			request.onsuccess = function(event) {
				const existente = event.target.result;
				console.log('[DEBUG] Resultado de site existente para dominio', site.dominio, ':', existente);
				if (existente) {
					site.id = existente.id;
					console.log('[DEBUG] Reutilizando ID existente do site:', site.id);
				}

				const putRequest = sitesStore.put(site);
				putRequest.onsuccess = function() {
					console.log('[DEBUG] Site adicionado/atualizado com sucesso:', site);
					resolve({ success: true });
				};
				putRequest.onerror = function(e) {
					console.error('Erro ao adicionar ou atualizar site:', e.target.error);
					reject(e.target.error);
				};
			};

			request.onerror = function(e) {
				console.error('Erro ao verificar site por domínio:', e.target.error);
				reject(e.target.error);
			};
		});
	}

	// [NOVO] - Função para obter todos os sites com dados completos
	async function obterTodosSitesCompleto(db) {
		console.log('[DEBUG] obterTodosSitesCompleto chamado.');
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['sites'], 'readonly');
			const sitesStore = transaction.objectStore('sites');
			const request = sitesStore.getAll();

			request.onsuccess = function(event) {
				const listaSites = event.target.result || [];
				console.log('[DEBUG] Lista de sites obtida:', listaSites);
				resolve(listaSites);
			};
			request.onerror = function(event) {
				console.error('[ERROR] Erro ao obter todos os sites:', event.target.error);
				reject(event.target.error);
			};
		});
	}

	// [NOVO] - Função para obter um site específico pelo ID
	async function obterSitePorId(db, idSite) {
		console.log('[DEBUG] obterSitePorId chamado com ID:', idSite);
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['sites'], 'readonly');
			const sitesStore = transaction.objectStore('sites');
			const request = sitesStore.get(Number(idSite));

			request.onsuccess = function(event) {
				const site = event.target.result;
				console.log('[DEBUG] Site retornado:', site);
				resolve(site);
			};
			request.onerror = function(event) {
				console.error('[ERROR] Erro ao obter site por ID:', event.target.error);
				reject(event.target.error);
			};
		});
	}

	// [NOVO] - Função para atualizar site (ID deve existir)
	async function atualizarSite(db, siteAtualizado) {
		console.log('[DEBUG] atualizarSite chamado com site:', siteAtualizado);
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['sites'], 'readwrite');
			const sitesStore = transaction.objectStore('sites');
			const request = sitesStore.put(siteAtualizado);

			request.onsuccess = function() {
				console.log('[DEBUG] Site atualizado com sucesso:', siteAtualizado);
				resolve(true);
			};
			request.onerror = function(event) {
				console.error('[ERROR] Erro ao atualizar site:', event.target.error);
				reject(event.target.error);
			};
		});
	}

	// [NOVO] - Função para excluir um site pelo ID
	async function excluirSite(db, idSite) {
		console.log('[DEBUG] excluirSite chamado com ID:', idSite);
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['sites'], 'readwrite');
			const sitesStore = transaction.objectStore('sites');
			const request = sitesStore.delete(Number(idSite));

			request.onsuccess = function() {
				console.log('[DEBUG] Site excluído com sucesso. ID:', idSite);
				resolve(true);
			};
			request.onerror = function(event) {
				console.error('[ERROR] Erro ao excluir site:', event.target.error);
				reject(event.target.error);
			};
		});
	}
	
  async function obterSitePorDominio(db, dominio) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sites'], 'readonly');
      const sitesStore = transaction.objectStore('sites');
      const index = sitesStore.index('dominio');
      const request = index.get(dominio);

      request.onsuccess = function(event) {
        resolve(event.target.result);
      };

      request.onerror = function(event) {
        console.error('Erro ao obter site por domínio:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function adicionarHistoricoPreco(db, entradaHistorico) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['historicoPrecos'], 'readwrite');
      const historicoStore = transaction.objectStore('historicoPrecos');
      const request = historicoStore.add(entradaHistorico);

      request.onsuccess = function() {
        resolve(true);
      };

      request.onerror = function(event) {
        console.error('Erro ao adicionar histórico de preço:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function limparHistoricoPrecoAntigo(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['historicoPrecos'], 'readwrite');
      const historicoStore = transaction.objectStore('historicoPrecos');
      const index = historicoStore.index('produtoId');
      const request = index.openCursor();

      const maxHistorico = 100;
      const historicoMap = new Map();

      request.onsuccess = function(event) {
        const cursor = event.target.result;
        if (cursor) {
          const produtoId = cursor.value.produtoId;
          if (!historicoMap.has(produtoId)) {
            historicoMap.set(produtoId, []);
          }
          historicoMap.get(produtoId).push(cursor.value);
          cursor.continue();
        } else {
          const deletions = [];
          historicoMap.forEach((entries, produtoId) => {
            if (entries.length > maxHistorico) {
              const excess = entries.length - maxHistorico;
              for (let i = 0; i < excess; i++) {
                deletions.push(entries[i].id);
              }
            }
          });

          if (deletions.length === 0) {
            resolve(true);
            return;
          }

          let deletados = 0;
          deletions.forEach(id => {
            const deleteRequest = historicoStore.delete(id);
            deleteRequest.onsuccess = function() {
              deletados++;
              if (deletados === deletions.length) {
                resolve(true);
              }
            };
            deleteRequest.onerror = function(event) {
              console.error('Erro ao deletar histórico de preço:', event.target.error);
              reject(event.target.error);
            };
          });
        }
      };

      request.onerror = function(event) {
        console.error('Erro ao iterar histórico de preços:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function enviarNotificacaoTelegram(mensagem, botToken, chatId) {
    if (!botToken || !chatId) {
      console.error('Bot Token ou Chat ID do Telegram não configurados.');
      return;
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const payload = {
      chat_id: chatId,
      text: mensagem,
      parse_mode: 'Markdown'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!data.ok) {
        console.error('Erro ao enviar mensagem para o Telegram:', data.description);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem para o Telegram:', error);
    }
  }

  async function obterConfiguracoesTelegram(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readonly');
      const settingsStore = transaction.objectStore('settings');
      const request = settingsStore.getAll();

      request.onsuccess = function(event) {
        const settings = event.target.result;
        const config = {};
        settings.forEach(item => {
          config[item.key] = item.value;
        });
        resolve(config);
      };

      request.onerror = function(event) {
        console.error('Erro ao obter configurações do Telegram:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function salvarConfiguracoesTelegram(db, botToken, chatId) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['settings'], 'readwrite');
      const settingsStore = transaction.objectStore('settings');

      const botTokenRequest = settingsStore.put({ key: 'botToken', value: botToken });
      const chatIdRequest = settingsStore.put({ key: 'chatId', value: chatId });

      let completou = 0;

      const verificarCompletou = () => {
        completou++;
        if (completou === 2) {
          resolve(true);
        }
      };

      botTokenRequest.onsuccess = verificarCompletou;
      botTokenRequest.onerror = function(event) {
        console.error('Erro ao salvar botToken:', event.target.error);
        reject(event.target.error);
      };

      chatIdRequest.onsuccess = verificarCompletou;
      chatIdRequest.onerror = function(event) {
        console.error('Erro ao salvar chatId:', event.target.error);
        reject(event.target.error);
      };
    });
  }

	async function enviarMensagemOffscreen(message) {
		console.log('[DEBUG] enviarMensagemOffscreen chamado com message:', message);
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage(message, (response) => {
				console.log('[DEBUG] Resposta recebida do offscreen:', response);
				if (chrome.runtime.lastError) {
					console.error('Erro ao enviar mensagem para offscreen:', chrome.runtime.lastError.message);
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}
				if (response && response.error) {
					console.error('Erro processado pelo offscreen:', response.error);
					reject(new Error(response.error));
					return;
				}
				resolve(response);
			});
		});
	}

  function extrairPreco(texto) {
    texto = texto.trim();

    // Substituir vírgula por ponto para padronizar
    texto = texto.replace(',', '.');

    // Remover qualquer caractere não numérico nem ponto
    texto = texto.replace(/[^0-9.]/g, '');

    const preco = parseFloat(texto);
    return isNaN(preco) ? null : preco;
  }

	async function verificarPrecos() {
		console.log('[DEBUG] verificarPrecos iniciado.');
		try {
			const db = await inicializarBancoDados();
			console.log('[DEBUG] Banco de dados inicializado com sucesso.');
			const produtos = await obterTodosProdutos(db);
			console.log('[DEBUG] Produtos obtidos:', produtos);

			await atualizarStatus('Verificando preços...');
			await adicionarLog(db, 'Iniciando verificação de preços.');

			for (const produto of produtos) {
				console.log('[DEBUG] Processando produto:', produto);
				if (produto.ativo === false) {
					console.log('[DEBUG] Produto inativo, pulando:', produto.id, produto.modelo);
					continue;
				}

				try {
					const { id, modelo, link, precoAnterior } = produto;
					console.log('[DEBUG] Produto ID:', id, 'Modelo:', modelo, 'Link:', link, 'PrecoAnterior:', precoAnterior);
					const url = new URL(link);
					const dominio = obterDominioRaiz(url.hostname);
					console.log('[DEBUG] Dominio raiz para este produto:', dominio);
					const site = await obterSitePorDominio(db, dominio);
					console.log('[DEBUG] Config site para este produto:', site);

					if (!site) {
						console.warn(`Configuração não encontrada para o domínio ${dominio}.`);
						await adicionarLog(db, `Configuração não encontrada para o domínio ${dominio}.`);
						return null;
					}

					const { cssSelector, attribute } = site;
					console.log('[DEBUG] Usando cssSelector e attribute do site:', cssSelector, attribute);
					const precoAtual = await buscarPrecoProduto(link, cssSelector, attribute);

					console.log('[DEBUG] Preço atual obtido:', precoAtual);
					if (precoAtual !== null) {
						chrome.runtime.sendMessage({
							action: 'atualizarCorLinha',
							id: id,
							encontrado: true,
						});
						console.log('[DEBUG] Linha atualizada para encontrado');
					} else {
						await adicionarLog(db, `Preço não encontrado para o produto "${modelo}" no link ${link}.`);
						chrome.runtime.sendMessage({
							action: 'atualizarCorLinha',
							id: id,
							encontrado: false,
						});
						console.log('[DEBUG] Linha atualizada para não encontrado');
					}

					const precoAntNum = parseFloat(precoAnterior);
					if (precoAtual !== null && precoAtual !== precoAntNum) {
						console.log('[DEBUG] Preço mudou. Antes:', precoAntNum, 'Agora:', precoAtual);
						produto.precoAnterior = precoAtual.toString();
						await atualizarProduto(db, produto);
						console.log('[DEBUG] Produto atualizado no DB com novo precoAnterior:', produto.precoAnterior);
						
                                                chrome.runtime.sendMessage({
                                                        action: 'produtoAtualizado',
                                                        produto: produto
                                                }, () => {
                                                        if (chrome.runtime.lastError) {
                                                                // Normalmente ocorre quando a página de opções não está aberta.
                                                                // Apenas ignore para evitar logs de erro desnecessários.
                                                                console.debug('[DEBUG] Nenhum receptor para produtoAtualizado:', chrome.runtime.lastError.message);
                                                        }
                                                });

						await recalcularMenorPrecoModelo(db, modelo);
						const produtoAtualizado = await obterProdutoPorId(db, id);
						console.log('[DEBUG] Produto após recalcularMenorPreco:', produtoAtualizado);
						const menorPrecoGlobal = parseFloat(produtoAtualizado.menorPreco);
						console.log('[DEBUG] menorPrecoGlobal:', menorPrecoGlobal);

						const entradaHistorico = {
							produtoId: id,
							timestamp: new Date().toISOString(),
							preco: precoAtual
						};
						await adicionarHistoricoPreco(db, entradaHistorico);
						console.log('[DEBUG] Histórico de preço adicionado:', entradaHistorico);

						await limparHistoricoPrecoAntigo(db);

						const variacao = ((precoAtual - precoAntNum) / precoAntNum) * 100;
						await adicionarLog(db, `Preço atualizado para ${modelo}: de R$ ${precoAnterior} para R$ ${precoAtual}.`);

						if (precoAtual < precoAntNum) {
							console.log('[DEBUG] Preço reduziu, enviando notificação Telegram.');

							// Converte para float e garante formatação
							const precoAtualFormatado = formatarBRL(precoAtual);
							const precoAnteriorFormatado = formatarBRL(precoAntNum);
							let menorPrecoGlobalNum = parseFloat(produtoAtualizado.menorPreco);
                                                        if (isNaN(menorPrecoGlobalNum)) {
                                                                menorPrecoGlobalNum = Infinity;
                                                        }
							const menorPrecoGlobalFormatado = formatarBRL(menorPrecoGlobalNum);

							const variacao = ((precoAtual - precoAntNum) / precoAntNum) * 100;

							let mensagem = '';

							// Verifica se novo precoAtual é menor ou igual ao menorPrecoGlobal
							if (precoAtual <= menorPrecoGlobalNum) {
								mensagem += '🚨 *MENOR PREÇO HISTÓRICO* 🚨\n\n';
							}

							mensagem += `O item *${modelo}* baixou o preço!\n\n` +
													`*Preço atual:* ${precoAtualFormatado}\n` +
													`*Preço anterior:* ${precoAnteriorFormatado}\n` +
													`*Redução de:* ${variacao.toFixed(1)}%\n` +
													`*Menor Preço Histórico Global:* ${menorPrecoGlobalFormatado}\n\n` +
													`[Link](${link})`;

							// Envia
							await enviarNotificacaoTelegram(mensagem, botToken, chatId);
							await adicionarLog(db, `Notificação enviada para ${modelo}.`);
						}
					} else {
						console.log('[DEBUG] Preço não mudou ou não encontrado. Nenhuma ação adicional.');
					}
				} catch (erro) {
					console.error(`Erro ao processar o item ${produto.modelo}:`, erro);
					await adicionarLog(db, `Erro ao processar o item ${produto.modelo}: ${erro.message}`);
				}
			}

			await limparLogsAntigos(db);

			await adicionarLog(db, 'Verificação de preços concluída.');
			await atualizarStatus('Ocioso');
			console.log('[DEBUG] verificarPrecos concluído com sucesso.');
		} catch (erro) {
			console.error('Erro na função verificarPrecos:', erro);
		}
	}


	async function buscarPrecoProduto(link, cssSelector, attribute) {
		console.log('[DEBUG] buscarPrecoProduto chamado com:', { link, cssSelector, attribute });
		await ensureOffscreenDocument();
		try {
			const response = await fetch(link);
			console.log('[DEBUG] fetch link status:', response.status, response.statusText);
			if (!response.ok) {
				throw new Error(`Falha ao buscar a página: ${response.statusText}`);
			}
			const html = await response.text();
			console.log('[DEBUG] HTML length:', html.length);

			const url = new URL(link);
			const dominio = obterDominioRaiz(url.hostname);
			console.log('[DEBUG] Dominio raiz obtido:', dominio);
			const db = await inicializarBancoDados();
			const site = await obterSitePorDominio(db, dominio);
			console.log('[DEBUG] Config site obtida:', site);

			const metodo = (site && site.metodoExtracao) ? site.metodoExtracao : null;
			console.log('[DEBUG] metodoExtracao obtido do site:', metodo);

			// Definir atributo para offscreen caso seja atributo
			const attrParaOffscreen = (metodo && metodo.tipo === 'atributo') ? metodo.nomeAttr : '';
			console.log('[DEBUG] attribute para offscreen:', attrParaOffscreen);

			const offscreenResponse = await enviarMensagemOffscreen({
				action: 'parseHtml',
				html: html,
				selector: site.cssSelector,
				attribute: attrParaOffscreen,
				from: 'background'
			});

			const valorExtraido = offscreenResponse ? offscreenResponse.result : null;
			console.log('[DEBUG] valorExtraido do offscreen:', valorExtraido);

			let preco = null;
			if (valorExtraido) {
				if (metodo && metodo.tipo === 'atributo') {
					console.log('[DEBUG] Método de extração: atributo. Valor bruto do atributo:', valorExtraido);
					// Assumindo que o atributo já contém apenas o número, ex: "799.92"
					const valorLimpo = valorExtraido.replace(',', '.').replace(/[^\d.]/g, '');
					preco = parseFloat(valorLimpo);
					console.log('[DEBUG] Preço final (atributo):', preco);
				} else if (metodo && metodo.tipo === 'texto') {
					console.log('[DEBUG] Método de extração: texto. Valor bruto:', valorExtraido);
					// Extrai do texto completo apenas o número correspondente ao valor
					preco = extrairPreco(valorExtraido);
					console.log('[DEBUG] Preço final (texto):', preco);
				} else {
					console.warn('[DEBUG] Nenhum metodoExtracao definido. Não faremos fallback. ValorExtraido:', valorExtraido);
					preco = null;
				}
			} else {
				console.warn('[DEBUG] Nenhum valorExtraido encontrado pelo offscreen. Preço é null.');
			}

			console.log('[DEBUG] Preço retornado por buscarPrecoProduto:', preco);
			return preco;
		} catch (erro) {
			console.error(`Erro ao buscar preço do link ${link}:`, erro);
			return null;
		}
	}

  async function verificarTermos() {
    try {
      const db = await inicializarBancoDados();
      const termos = await obterTodosTermos(db);

      await atualizarStatus('Verificando termos...');
      await adicionarLog(db, 'Iniciando verificação de termos.');

      for (const termoObj of termos) {
        if (termoObj.ativo === false) {
          continue;
        }

        try {
          const { descricao, link, termo } = termoObj;
          const response = await fetch(link);
          if (!response.ok) {
            console.warn(`Falha ao buscar o link ${link}: ${response.statusText}`);
            await adicionarLog(db, `Falha ao buscar o link ${link}: ${response.statusText}`);
            continue;
          }

          const html = await response.text();

          await ensureOffscreenDocument();

          const termoEncontrado = await enviarMensagemOffscreen({
            action: 'verificarTermo',
            html: html,
            termo: termo
						, from: 'background'
          });

          if (termoEncontrado.encontrado) {
            const config = await obterConfiguracoesTelegram(db);
            const botToken = config.botToken;
            const chatId = config.chatId;

            const mensagem = `🔍 *Termo Encontrado*\n\n` +
                             `*Descrição:* ${descricao}\n` +
                             `*Termo:* "${termo}" encontrado no link [Clique Aqui](${link}).`;

            await enviarNotificacaoTelegram(mensagem, botToken, chatId);

            await adicionarLog(db, `Notificação de termo encontrado para "${descricao}" enviada.`);
          }
        } catch (erro) {
          console.error(`Erro ao processar o termo "${termoObj.descricao}":`, erro);
          await adicionarLog(db, `Erro ao processar o termo "${termoObj.descricao}": ${erro.message}`);
        }
      }

      await adicionarLog(db, 'Verificação de termos concluída.');
      await atualizarStatus('Ocioso');
    } catch (erro) {
      console.error('Erro na função verificarTermos:', erro);
    }
  }

  async function atualizarStatus(status) {
    chrome.runtime.sendMessage({ action: 'statusAtualizado', status: status }, function(response) {
      if (chrome.runtime.lastError) {
        // Ignorar se nenhum receptor
      }
    });
  }

	async function enviarMensagemContentScript(tabId, message) {
		return new Promise((resolve, reject) => {
			chrome.tabs.sendMessage(tabId, message, (response) => {
				if (chrome.runtime.lastError) {
					console.error('Erro ao enviar mensagem para content script:', chrome.runtime.lastError.message);
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}
				if (response.error) {
					console.error('Erro processado pelo content script:', response.error);
					reject(new Error(response.error));
					return;
				}
				resolve(response);
			});
		});
	}

	async function analisarLinkParaSeletores(link, valorProcurado) {
		console.log('[DEBUG] analisarLinkParaSeletores chamado com:', { link, valorProcurado });
		valorProcurado = valorProcurado.trim().replace(',', '.');
		console.log('[DEBUG] valorProcurado normalizado:', valorProcurado);

		const response = await fetch(link);
		console.log('[DEBUG] fetch status:', response.status, response.statusText);
		if (!response.ok) {
			throw new Error(`Falha ao buscar o link: ${response.statusText}`);
		}

		const html = await response.text();
		console.log('[DEBUG] HTML length para analisarLinkParaSeletores:', html.length);
		console.log('[DEBUG] HTML capturado:', html); 
		await ensureOffscreenDocument();
		const opcoes = await enviarMensagemOffscreen({
			action: 'analisarHtmlParaSeletores',
			html: html,
			valorProcurado: valorProcurado,
			from: 'background'
		});
		console.log('[DEBUG] Opções retornadas pelo offscreen:', opcoes);
		return opcoes.opcoes;
	}

	let offscreenInicializado = false;

	async function ensureOffscreenDocument() {
		const offscreenUrl = 'offscreen.html';

		try {
			// Verifica se o documento offscreen já existe
			const existe = await chrome.offscreen.hasDocument();
			if (!existe) {
				console.log('Criando o documento offscreen...');
				await chrome.offscreen.createDocument({
					url: offscreenUrl,
					reasons: ['DOM_PARSER'],
					justification: 'Necessário para processar HTML e extrair informações'
				});
				offscreenInicializado = true;
				console.log('Documento offscreen criado com sucesso.');
			} else {
				console.log('Documento offscreen já existe.');
			}
		} catch (erro) {
			console.error('Erro ao criar/verificar o offscreen document:', erro.message);
			offscreenInicializado = false;
		}
	}

  async function obterListaModelos(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['produtos'], 'readonly');
    const store = transaction.objectStore('produtos');
    const request = store.getAll();

    request.onsuccess = function(event) {
      const produtos = event.target.result || [];
      const modelos = [...new Set(produtos.map(p => p.modelo))].sort();
      resolve(modelos);
    };

    request.onerror = function(event) {
      console.error('Erro ao obter lista de modelos:', event.target.error);
      reject(event.target.error);
    };
  });
}

  // Nova função para obter lista de sites (domínios)
  async function obterListaSites(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sites'], 'readonly');
      const sitesStore = transaction.objectStore('sites');
      const request = sitesStore.getAll();

      request.onsuccess = function(event) {
        const sites = event.target.result || [];
        const dominios = sites.map(s => s.dominio).sort();
        resolve(dominios);
      };
      request.onerror = function(event) {
        reject(event.target.error);
      };
    });
  }

	async function recalcularMenorPrecoModelo(db, modelo) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['produtos'], 'readwrite');
			const produtosStore = transaction.objectStore('produtos');
			const index = produtosStore.index('modelo');
			const request = index.getAll(modelo);

			request.onsuccess = async function(event) {
				const produtos = event.target.result;
				if (produtos.length === 0) {
					resolve(true);
					return;
				}

				let menorGlobal = Infinity;
				// Encontrar o menor precoAnterior entre todos os produtos do modelo
				for (const p of produtos) {
					const precoAnterior = parseFloat(p.precoAnterior);
					if (!isNaN(precoAnterior) && precoAnterior < menorGlobal) {
						menorGlobal = precoAnterior;
					}
				}

				if (menorGlobal === Infinity) {
					// Nenhum precoAnterior válido encontrado
					menorGlobal = null; // Ou defina um valor padrão
				}

				// Atualizar o menorPreco para todos os produtos do modelo
				for (const p of produtos) {
					if (menorGlobal !== null) {
						p.menorPreco = (parseFloat(p.precoAnterior) < menorGlobal ? parseFloat(p.precoAnterior) : menorGlobal).toString();
					} else {
						p.menorPreco = parseFloat(p.precoAnterior).toString();
					}
					await new Promise((res, rej) => {
						const reqPut = produtosStore.put(p);
						reqPut.onsuccess = () => res();
						reqPut.onerror = (e) => rej(e.target.error);
					});
				}

				resolve(true);
			};

			request.onerror = function(event) {
				reject(event.target.error);
			};
		});
	}

	async function obterTodosSitesPersonalizados(db) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(['produtos'], 'readonly');
			const store = transaction.objectStore('produtos');
			const request = store.getAll();

			request.onsuccess = function(event) {
				const produtos = event.target.result || [];
				const sites = [...new Set(produtos.map(p => p.site).filter(s => s))].sort(); // Pega valores únicos e ordenados
				resolve(sites);
			};

			request.onerror = function(event) {
				console.error('Erro ao obter lista de sites personalizados:', event.target.error);
				reject(event.target.error);
			};
		});
	}

  async function obterLogs(db) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['logs'], 'readonly');
      const logsStore = transaction.objectStore('logs');
      const request = logsStore.getAll();

      request.onsuccess = function(event) {
        resolve(event.target.result);
      };

      request.onerror = function(event) {
        console.error('Erro ao obter logs:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  function agendarVerificacao() {
    chrome.alarms.create('verificacaoPreco', { periodInMinutes: intervaloVerificacao });
    chrome.alarms.create('verificacaoTermo', { periodInMinutes: intervaloVerificacao });
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'verificacaoPreco') {
      verificarPrecos();
    } else if (alarm.name === 'verificacaoTermo') {
      verificarTermos();
    }
  });

  chrome.runtime.onInstalled.addListener(() => {
    agendarVerificacao();
    verificarPrecos();
    verificarTermos();
  });

  chrome.runtime.onStartup.addListener(() => {
    agendarVerificacao();
    verificarPrecos();
    verificarTermos();
  });

  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Mensagem recebida em background.js:', request);

    if (
      request.action === 'parseHtml' ||
      request.action === 'analisarHtmlParaSeletores' ||
      request.action === 'verificarTermo'
    ) {
      enviarMensagemOffscreen(request)
        .then(response => {
          sendResponse(response);
        })
        .catch(erro => {
          sendResponse({ error: erro.message });
        });
      return true;
    }

    (async () => {
      if (!request.action) {
        sendResponse({ success: false, error: 'Ação não especificada.' });
        return;
      }

      const db = await inicializarBancoDados();

      switch (request.action) {
        case 'obterProdutos':
          try {
            const produtos = await obterTodosProdutos(db);
            sendResponse({ success: true, produtos: produtos });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'adicionarProduto':
					try {
						await adicionarProduto(db, request.produto);
						await adicionarLog(db, `Produto adicionado: ${request.produto.modelo}`);
						// Recalcular o menorPreco após adicionar o produto
						await recalcularMenorPrecoModelo(db, request.produto.modelo);
						sendResponse({ success: true });
					} catch (erro) {
						sendResponse({ success: false, error: erro });
					}
					break;

        case 'atualizarProduto':
          try {
            await atualizarProduto(db, request.produto);
            await adicionarLog(db, `Produto atualizado: ${request.produto.modelo}`);
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'obterProdutoPorId':
          try {
            const produto = await obterProdutoPorId(db, request.id);
            if (produto) {
              sendResponse({ success: true, produto: produto });
            } else {
              sendResponse({ success: false, error: 'Produto não encontrado.' });
            }
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'excluirProduto':
          try {
            await excluirProduto(db, request.id);
            await adicionarLog(db, `Produto excluído com ID: ${request.id}`);
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'obterTermos':
          try {
            const termos = await obterTodosTermos(db);
            sendResponse({ success: true, termos: termos });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'adicionarTermo':
          try {
            await adicionarTermo(db, request.termo);
            await adicionarLog(db, `Termo adicionado: ${request.termo.descricao}`);
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'atualizarTermo':
          try {
            await atualizarTermo(db, request.termo);
            await adicionarLog(db, `Termo atualizado: ${request.termo.descricao}`);
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'obterTermoPorId':
          try {
            const termo = await obterTermoPorId(db, request.id);
            if (termo) {
              sendResponse({ success: true, termo: termo });
            } else {
              sendResponse({ success: false, error: 'Termo não encontrado.' });
            }
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'excluirTermo':
          try {
            await excluirTermo(db, request.id);
            await adicionarLog(db, `Termo excluído com ID: ${request.id}`);
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'adicionarOuAtualizarSite':
          try {
            await adicionarOuAtualizarSite(db, request.site);
            await adicionarLog(db, `Site adicionado/atualizado para domínio: ${request.site.dominio}`);
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

				case 'analisarLink':
					try {
						console.log('Recebendo ação "analisarLink" com dados:', request);

						// Extrair domínio do link
						const urlTemp = new URL(request.link);
						const dominioTemp = obterDominioRaiz(urlTemp.hostname.replace('www.', ''));
						console.log('[DEBUG] Dominio obtido em "analisarLink":', dominioTemp);

						// Verificar se já existe config para esse domínio
						const dbLocal = await inicializarBancoDados();
						const siteExistente = await obterSitePorDominio(dbLocal, dominioTemp);

						if (siteExistente) {
							// Se já existe, retornamos siteConfig e success = true
							console.log('[DEBUG] Dominio já cadastrado. Retornando siteExistente.');
							sendResponse({ 
								success: true, 
								siteConfig: siteExistente 
							});
						} else {
							// Caso não exista, chamamos o analisarLinkParaSeletores
							const opcoes = await analisarLinkParaSeletores(request.link, request.valorProcurado);
							console.log('Seletores processados pelo offscreen.js:', opcoes);
							sendResponse({ success: true, opcoes });
						}
					} catch (erro) {
						console.error('Erro ao processar "analisarLink":', erro);
						sendResponse({ success: false, error: erro.message });
					}
					break;

        case 'definirIntervaloTempo':
          try {
            intervaloVerificacao = parseInt(request.intervaloTempo);
            await adicionarLog(db, `Intervalo de verificação definido para ${intervaloVerificacao} minutos.`);
            chrome.alarms.clear('verificacaoPreco');
            chrome.alarms.create('verificacaoPreco', { periodInMinutes: intervaloVerificacao });
            chrome.alarms.clear('verificacaoTermo');
            chrome.alarms.create('verificacaoTermo', { periodInMinutes: intervaloVerificacao });
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'obterLogs':
          try {
            const logs = await obterLogs(db);
            sendResponse({ success: true, logs: logs });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'salvarConfiguracoesTelegram':
          try {
            await salvarConfiguracoesTelegram(db, request.botToken, request.chatId);
            await adicionarLog(db, `Configurações do Telegram salvas.`);
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'obterConfiguracoesTelegram':
          try {
            const config = await obterConfiguracoesTelegram(db);
            sendResponse({ success: true, configuracoes: config });
          } catch (erro) {
            sendResponse({ success: false, error: erro });
          }
          break;

        case 'executarAgora':
          try {
            await verificarPrecos();
            await verificarTermos();
            sendResponse({ success: true });
          } catch (erro) {
            sendResponse({ success: false, error: erro.message });
          }
          break;

        case 'atualizarProdutoAtivo':
          try {
            const { id, ativo } = request;
            const produto = await obterProdutoPorId(db, id);

            if (!produto) {
              sendResponse({ success: false, error: 'Produto não encontrado.' });
              break;
            }

            produto.ativo = ativo;
            await atualizarProduto(db, produto);

            await adicionarLog(db, `Status do produto "${produto.modelo}" atualizado para ${ativo ? 'ativo' : 'inativo'}.`);
            sendResponse({ success: true });
          } catch (erro) {
            console.error('Erro ao atualizar status do produto:', erro);
            sendResponse({ success: false, error: erro.message });
          }
          break;

        case 'atualizarTermoAtivo':
          try {
            const { id, ativo } = request;
            const termo = await obterTermoPorId(db, id);

            if (!termo) {
              sendResponse({ success: false, error: 'Termo não encontrado.' });
              break;
            }

            termo.ativo = ativo;
            await atualizarTermo(db, termo);

            await adicionarLog(db, `Status do termo "${termo.descricao}" atualizado para ${ativo ? 'ativo' : 'inativo'}.`);
            sendResponse({ success: true });
          } catch (erro) {
            console.error('Erro ao atualizar status do termo:', erro);
            sendResponse({ success: false, error: erro.message });
          }
          break;

				case 'obterListaModelos':
					try {
						const modelos = await obterListaModelos(db); // Função que obtém os modelos do banco
						sendResponse({ success: true, modelos: modelos });
					} catch (erro) {
						console.error('Erro ao obter lista de modelos:', erro);
						sendResponse({ success: false, error: erro.message });
					}
					break;

        case 'obterListaSitesPersonalizados':
					try {
						const sites = await obterTodosSitesPersonalizados(db); // Ajuste para carregar os valores personalizados da coluna "Site"
						sendResponse({ success: true, sites });
					} catch (erro) {
						sendResponse({ success: false, error: erro.message });
					}
					break;

        case 'excluirTodosLogs':
					try {
						const resultado = await excluirTodosLogs(db);
						if (resultado) {
							sendResponse({ success: true });
						} else {
							sendResponse({ success: false, error: 'Erro desconhecido ao excluir logs.' });
						}
					} catch (erro) {
						console.error('Erro ao excluir logs:', erro);
						sendResponse({ success: false, error: erro.message });
					}
					break;

				// [NOVO] Obter lista completa de sites (com ID, etc.)
				case 'obterTodosSitesCompleto':
					try {
						const listaSites = await obterTodosSitesCompleto(db);
						sendResponse({ success: true, sites: listaSites });
					} catch (erro) {
						sendResponse({ success: false, error: erro.message });
					}
					break;

				// [NOVO] Obter site específico pelo ID
				case 'obterSitePorId':
					try {
						const siteEncontrado = await obterSitePorId(db, request.idSite);
						if (!siteEncontrado) {
							sendResponse({ success: false, error: 'Site não encontrado.' });
						} else {
							sendResponse({ success: true, site: siteEncontrado });
						}
					} catch (erro) {
						sendResponse({ success: false, error: erro.message });
					}
					break;

				// [NOVO] Atualizar site
				case 'atualizarSite':
					try {
						await atualizarSite(db, request.site);
						await adicionarLog(db, `Site atualizado para domínio: ${request.site.dominio}`);
						sendResponse({ success: true });
					} catch (erro) {
						sendResponse({ success: false, error: erro.message });
					}
					break;
				
				// [NOVO] Excluir site
				case 'excluirSite':
					try {
						await excluirSite(db, request.idSite);
						await adicionarLog(db, `Site excluído com ID: ${request.idSite}`);
						sendResponse({ success: true });
					} catch (erro) {
						sendResponse({ success: false, error: erro.message });
					}
					break;
					
				case 'obterProdutosComSites':
					try {
						// 1. Obter todos os produtos
						const produtos = await obterTodosProdutos(db);

						// 2. Montar array final sobrescrevendo config do site
						const produtosComSites = [];
						for (const produto of produtos) {
							const urlObj = new URL(produto.link);
							const dominioRaiz = obterDominioRaiz(urlObj.hostname.replace('www.', ''));
							// Buscar config do site
							const siteConfig = await obterSitePorDominio(db, dominioRaiz);

							// Clonar ou reutilizar a base do produto
							let produtoFinal = { ...produto };

							// Se houver config em "sites", sobrescreve
							if (siteConfig) {
								produtoFinal.cssSelector = siteConfig.cssSelector;
								produtoFinal.attribute = siteConfig.attribute;
								produtoFinal.metodoExtracao = siteConfig.metodoExtracao;
							}

							produtosComSites.push(produtoFinal);
						}

						sendResponse({ success: true, produtos: produtosComSites });
					} catch (erro) {
						console.error('[ERROR] Ao mesclar sites no produto:', erro);
						sendResponse({ success: false, error: erro.message });
					}
					break;
					
        default:
          sendResponse({ success: false, error: 'Ação desconhecida.' });
      }
    })();

    return true; // manter o canal aberto para chamadas assíncronas
  });
	
	async function migrarDominios() {
		console.log('[DEBUG] Iniciando migração de domínios...');
		try {
			const db = await inicializarBancoDados();
			const transaction = db.transaction(['sites'], 'readwrite');
			const sitesStore = transaction.objectStore('sites');

			const sites = await new Promise((resolve, reject) => {
				const request = sitesStore.getAll();
				request.onsuccess = function(event) {
					resolve(event.target.result);
				};
				request.onerror = function(event) {
					console.error('Erro ao obter sites para migração:', event.target.error);
					reject(event.target.error);
				};
			});

			console.log('[DEBUG] Sites obtidos para migração:', sites);

			for (const site of sites) {
				const dominioCorrigido = obterDominioRaiz(site.dominio);
				if (dominioCorrigido !== site.dominio) {
					console.log(`[DEBUG] Migrando site ID ${site.id} de dominio "${site.dominio}" para "${dominioCorrigido}"`);
					site.dominio = dominioCorrigido;

					// **Garantir que metodoExtracao está presente e completo**
					if (!site.metodoExtracao || !site.metodoExtracao.tipo) {
						// Definir um método padrão se estiver faltando
						site.metodoExtracao = { tipo: 'texto' };
						console.warn(`[WARN] metodoExtracao faltando para site ID ${site.id}. Definido como texto.`);
					}

					try {
						await adicionarOuAtualizarSite(db, site);
						console.log(`[DEBUG] Site ID ${site.id} migrado com sucesso.`);
					} catch (erro) {
						console.error(`[DEBUG] Erro ao migrar site ID ${site.id}:`, erro);
					}
				}
			}

			console.log('[DEBUG] Migração de domínios concluída.');
		} catch (erro) {
			console.error('[DEBUG] Erro na migração de domínios:', erro);
		}
	}

	// Chamar a função migrarDominios após a definição das funções necessárias
	migrarDominios();
}

async function obterConfiguracaoPorDominio(db, dominio) {
  console.log('[DEBUG] obterConfiguracaoPorDominio chamado com dominio:', dominio);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['sites'], 'readonly');
    const sitesStore = transaction.objectStore('sites');
    const request = sitesStore.get(dominio);

    request.onsuccess = function(event) {
      const config = event.target.result;
      console.log('[DEBUG] Configuração obtida para dominio', dominio, ':', config);
      resolve(config);
    };

    request.onerror = function(event) {
      console.error('Erro ao obter configuração por domínio:', event.target.error);
      reject(event.target.error);
    };
  });
}

function validarDominio(dominio) {
  // Expressão regular para validar domínios comuns (ex: exemplo.com, exemplo.com.br)
  const regex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.(?:[A-Za-z]{2,6}\.)?[A-Za-z]{2,6}$/;
  return regex.test(dominio);
}
