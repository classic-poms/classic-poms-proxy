/**
 * Classic Poms Proxy — Production Server (v1.1)
 * Gemini API com: Exponential Backoff, Sliding Window e Safety Settings
 */

const https = require('https');
const http  = require('http');
const PORT  = process.env.PORT || 3000;

// -- CONFIGURAÇÃO --
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'; // Recomendado para estabilidade inicial
const MAX_HISTORY_MESSAGES = 8; // Aumentei levemente para melhor contexto
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 2000;

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
];

// -- UTILITÁRIOS --
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

function log(level, msg, data) {
  const ts = new Date().toISOString();
  let line = `[${ts}] [${level}] ${msg}`;
  if (data) line += ` ${JSON.stringify(data)}`;
  console.log(line);
}

// -- LÓGICA DE CHAMADA COM RETRY --
function callGemini(geminiPayload, attempt = 1) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(geminiPayload);
    
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', (chunk) => { data += chunk; });
      apiRes.on('end', () => {
        const status = apiRes.statusCode;

        // Tratar Rate Limit (429) com Backoff
        if (status === 429 && attempt <= MAX_RETRIES) {
          const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
          log('WARN', `Cota excedida. Retry #${attempt} em ${waitMs/1000}s`);
          return sleep(waitMs).then(() => callGemini(geminiPayload, attempt + 1).then(resolve).catch(reject));
        }

        if (status !== 200) {
          log('ERROR', `Erro API Gemini: ${status}`, data);
          return reject({ status, message: `Erro na API: ${status}` });
        }

        try {
          const response = JSON.parse(data);
          const candidate = response.candidates && response.candidates[0];
          
          if (candidate && candidate.finishReason === 'SAFETY') {
            return resolve([{ type: 'text', text: 'Conteúdo filtrado por segurança. Tente reformular.' }]);
          }

          const parts = (candidate && candidate.content && candidate.content.parts) || [];
          const output = parts.map(p => ({ type: 'text', text: p.text || '' }));
          
          log('INFO', 'Resposta gerada com sucesso.');
          resolve(output);
        } catch (e) {
          reject({ status: 500, message: 'Falha ao processar resposta JSON' });
        }
      });
    });

    apiReq.on('error', (e) => reject({ status: 503, message: e.message }));
    apiReq.write(postData);
    apiReq.end();
  });
}

// -- SERVIDOR --
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Rota de Health Check
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'Classic Poms Online', model: MODEL }));
    return;
  }

  // Rota do Chat
  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        let contents = [];

        // Injeta Instrução de Sistema
        if (payload.system) {
          contents.push({ role: 'user', parts: [{ text: `INSTRUÇÃO DE SISTEMA: ${payload.system}` }] });
          contents.push({ role: 'model', parts: [{ text: 'Entendido. Seguirei essas diretrizes.' }] });
        }

        // Janela Deslizante (Histórico)
        let history = payload.messages || [];
        if (history.length > MAX_HISTORY_MESSAGES) {
          history = history.slice(-MAX_HISTORY_MESSAGES);
        }

        history.forEach(msg => {
          contents.push({
            role: (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user',
            parts: [{ text: msg.content }]
          });
        });

        const result = await callGemini({
          contents,
          safetySettings: SAFETY_SETTINGS,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: result }));

      } catch (err) {
        res.writeHead(err.status || 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404); res.end();
  }
});

server.listen(PORT, () => {
  log('INFO', `Servidor Classic Poms rodando na porta ${PORT}`);
});
