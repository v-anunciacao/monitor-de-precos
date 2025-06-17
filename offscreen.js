
// offscreen.js

console.log('offscreen.js carregado.');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Mensagem recebida no offscreen.js:', request);

  if (request.from !== 'background') {
    // Mensagem não veio do background, ignorar sem responder
    return;
  }

	if (request.action === "analisarHtmlParaSeletores") {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(request.html, "text/html");

			// Adicionando log de todos os elementos <meta>
			const metaElements = Array.from(doc.querySelectorAll('meta'));
			console.log('[DEBUG] Elementos <meta> encontrados:', metaElements);

			const opcoes = [];
			let valorProcurado = request.valorProcurado.trim();
			// Regex genérica para capturar números decimais
			const regexNumero = /\d+(?:[.,]\d+)?/g;

			const allElements = Array.from(doc.querySelectorAll('*'));

			allElements.forEach(el => {
				const text = el.textContent.trim();
				let matchedNumberRaw = null;
				let matchedAttribute = '';

				// 1. Verifica no texto do elemento
				const numerosEncontradosTexto = text.match(regexNumero);
				if (numerosEncontradosTexto) {
					for (const numero of numerosEncontradosTexto) {
						const numeroNorm = numero.replace(',', '.');
						const procuradoFloat = parseFloat(valorProcurado);
						const numeroFloat = parseFloat(numeroNorm);
						if (!isNaN(numeroFloat) && !isNaN(procuradoFloat) && numeroFloat === procuradoFloat) {
							matchedNumberRaw = numero;
							console.log(`[DEBUG] Número encontrado no texto: ${numero} em elemento:`, el);
							break;
						}
					}
				}

				// 2. Se não achou no texto, verifica em todos os atributos do elemento
				if (!matchedNumberRaw && el.attributes.length > 0) {
					for (const attr of el.attributes) {
						const numerosAtributo = attr.value.match(regexNumero);
						if (numerosAtributo) {
							for (const numero of numerosAtributo) {
								const numeroNorm = numero.replace(',', '.');
								const procuradoFloat = parseFloat(valorProcurado);
								const numeroFloat = parseFloat(numeroNorm);
								if (!isNaN(numeroFloat) && !isNaN(procuradoFloat) && numeroFloat === procuradoFloat) {
									matchedNumberRaw = numero;
									matchedAttribute = attr.name;
									console.log(`[DEBUG] Número encontrado no atributo "${attr.name}": ${numero} em elemento:`, el);
									break;
								}
							}
							if (matchedNumberRaw) break;
						}
					}
				}

				if (matchedNumberRaw) {
					const selector = getUniqueSelector(el);
					let metodoExtracao = null;
					if (matchedAttribute) {
						// Número encontrado em um atributo
						metodoExtracao = { tipo: 'atributo', nomeAttr: matchedAttribute };
					} else {
						// Número encontrado no texto do elemento
						metodoExtracao = { tipo: 'texto' };
					}

					opcoes.push({
						selector: selector,
						attribute: matchedAttribute,
						preview: matchedNumberRaw,
						metodoExtracao: metodoExtracao
					});
				}
			});

			const uniqueOpcoes = opcoes.filter((v, i, a) => a.findIndex(t => t.selector === v.selector) === i);
			sendResponse({ opcoes: uniqueOpcoes });
		} catch (error) {
			console.error('Erro ao analisar HTML para seletores:', error);
			sendResponse({ error: error.message });
		}
	}
	else if (request.action === "parseHtml") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(request.html, "text/html");
			
			// Adicionando log de todos os elementos <meta>
			const metaElements = Array.from(doc.querySelectorAll('meta'));
			console.log('[DEBUG] Elementos <meta> encontrados:', metaElements);

      const element = doc.querySelector(request.selector);
      if (!element) {
        console.warn(`Elemento não encontrado com o seletor "${request.selector}".`);
        console.debug('Trecho do HTML recebido:', request.html.slice(0, 200));
        sendResponse({ result: null });
        return;
      }

      let value;
      if (request.attribute) {
        value = element.getAttribute(request.attribute);
        console.log('[DEBUG] Valor extraído via atributo:', value);
      } else {
        value = element.textContent.trim();
        console.log('[DEBUG] Valor extraído via texto:', value);
      }

      sendResponse({ result: value });
    } catch (error) {
      console.error('Erro ao parsear HTML para parseHtml:', error);
      sendResponse({ error: error.message });
    }
  }

	// Dentro do chrome.runtime.onMessage.addListener no offscreen.js
	else if (request.action === "verificarTermo") {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(request.html, "text/html");
			const termo = request.termo.toLowerCase();
			
			// Adicionando log de todos os elementos <meta>
			const metaElements = Array.from(doc.querySelectorAll('meta'));
			console.log('[DEBUG] Elementos <meta> encontrados:', metaElements);

			// Busca o termo no texto do documento
			const texto = doc.body.textContent.toLowerCase();
			const encontrado = texto.includes(termo);

			sendResponse({ encontrado: encontrado });
		} catch (error) {
			console.error('Erro ao verificar termo:', error);
			sendResponse({ error: error.message });
		}
	}

  return false; // Como não fazemos operações assíncronas aqui, não precisamos retornar true
});

function getUniqueSelector(el) {
  console.log('Gerando seletor único para elemento:', el);

  if (el.id) {
    console.log('Seletor gerado pelo ID:', `#${el.id}`);
    return `#${el.id}`;
  }

  let selector = el.nodeName.toLowerCase();

  // Adicionar atributos significativos
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

  const uniqueSelector = path.join(' > ');
  console.log('Seletor completo gerado:', uniqueSelector);
  return uniqueSelector;
}

