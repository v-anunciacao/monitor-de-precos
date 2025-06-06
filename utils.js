// utils.js

// Função para ler um arquivo CSV e retornar um array de objetos
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    fetch('file:///' + filePath.replace(/\\/g, '/'))
      .then(response => response.text())
      .then(text => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',');
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          const item = {};
          headers.forEach((header, index) => {
            item[header.trim()] = values[index] ? values[index].trim() : '';
          });
          return item;
        });
        resolve(data);
      })
      .catch(error => reject(error));
  });
}

// Função para escrever dados em um arquivo CSV
async function updateCSV(filePath, data) {
  const headers = Object.keys(data[0]);
  const lines = [headers.join(',')];
  data.forEach(item => {
    const values = headers.map(header => item[header]);
    lines.push(values.join(','));
  });
  const csvContent = lines.join('\n');
  // Escrever no arquivo (considerando que a extensão tem permissão)
  await writeFile(filePath, csvContent);
}

// Função para registrar o histórico de preços
async function logPriceHistory(filePath, link, price) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp},${link},${price}\n`;
  // Anexar ao arquivo (considerando que a extensão tem permissão)
  await appendToFile(filePath, line);
}

// Função para buscar o preço do produto
async function fetchProductPrice(url, cssSelector, attribute) {
  const response = await fetch(url);
  const html = await response.text();

  // Usar DOMParser para analisar o HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const element = doc.querySelector(cssSelector);
  if (!element) {
    throw new Error('Elemento não encontrado com o seletor CSS fornecido.');
  }

  let price;
  if (attribute) {
    price = element.getAttribute(attribute);
  } else {
    price = element.textContent;
  }

  // Extrair o número do preço
  price = parseFloat(price.replace(/[^\d.,-]/g, '').replace(',', '.'));

  if (isNaN(price)) {
    throw new Error('Preço não pôde ser convertido em número.');
  }

  return price;
}

// Função para enviar notificação via Telegram
async function sendTelegramNotification(modelo, precoAtual, precoAnterior, variacao, link) {
  const botToken = 'SEU_TELEGRAM_BOT_TOKEN';
  const chatId = 'SEU_CHAT_ID';
  const message = `O item **${modelo}** baixou o preço!!!\n\n` +
                  `Preço atual: R$ ${precoAtual}\n` +
                  `Preço anterior: R$ ${precoAnterior}\n` +
                  `Redução de ${variacao.toFixed(1)}%.\n\n` +
                  `Link: ${link}`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
  });
}

// Função para escrever em um arquivo (pode ser necessário usar a API de armazenamento do navegador)
async function writeFile(filePath, content) {
  console.error('Função writeFile não implementada.');
}

// Função para anexar conteúdo a um arquivo
async function appendToFile(filePath, content) {
  console.error('Função appendToFile não implementada.');
}
