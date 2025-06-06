// content.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Mensagem recebida no content.js:', request);

  if (request.action === "parseHtml") {
    try {
      const element = document.querySelector(request.selector);
      if (!element) {
        console.warn(`Elemento não encontrado com o seletor "${request.selector}".`);
        sendResponse({ result: null });
        return;
      }

      let value;
      if (request.attribute) {
        value = element.getAttribute(request.attribute);
      } else {
        value = element.textContent.trim();
      }

      sendResponse({ result: value });
    } catch (error) {
      console.error('Erro ao parsear HTML para parseHtml:', error);
      sendResponse({ error: error.message });
    }

    return true; // Indica que a resposta será enviada de forma assíncrona
  }

  if (request.action === "analisarHtmlParaSeletores") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(request.html, "text/html");

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

  return false; // Não faz operações assíncronas
});

// Helper function to generate unique selector
function getUniqueSelector(el) {
  console.log('Gerando seletor único para elemento:', el);

  if (el.id) {
    console.log('Seletor gerado pelo ID:', `#${el.id}`);
    return `#${el.id}`;
  }

  const path = [];
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();

    if (el.className) {
      selector += '.' + Array.from(el.classList).join('.');
    }

    const siblings = el.parentNode ? Array.from(el.parentNode.children).filter(child => child.nodeName === el.nodeName) : [];
    if (siblings.length > 1) {
      const index = siblings.indexOf(el) + 1;
      selector += `:nth-of-type(${index})`;
    }

    path.unshift(selector);
    el = el.parentNode;
  }

  console.log('Seletor completo gerado:', path.join(' > '));
  return path.join(' > ');
}
