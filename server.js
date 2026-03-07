const https = require(‘https’);
const http = require(‘http’);

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const server = http.createServer((req, res) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) { res.writeHead(204); res.end(); return; }

if (req.method === ‘GET’ && req.url === ‘/’) {
res.writeHead(200, { ‘Content-Type’: ‘application/json’ });
res.end(JSON.stringify({ status: ‘Classic Proxy (Gemini) online 🐾’, key_ok: !!GEMINI_API_KEY }));
return;
}

if (req.method !== ‘POST’ || req.url !== ‘/chat’) {
res.writeHead(404); res.end(JSON.stringify({ error: ‘Not found’ })); return;
}

if (!GEMINI_API_KEY) {
res.writeHead(500, { ‘Content-Type’: ‘application/json’ });
res.end(JSON.stringify({ error: ‘GEMINI_API_KEY não configurada no servidor!’ }));
return;
}

let body = ‘’;
req.on(‘data’, chunk => { body += chunk.toString(); });
req.on(‘end’, () => {
let payload;
try { payload = JSON.parse(body); }
catch (e) {
res.writeHead(400); res.end(JSON.stringify({ error: ‘Invalid JSON’ })); return;
}

```
// Converte formato Anthropic → Gemini
const contents = [];
if (payload.system) {
  contents.push({ role: 'user', parts: [{ text: '### INSTRUÇÕES DO SISTEMA ###\n' + payload.system }] });
  contents.push({ role: 'model', parts: [{ text: 'Entendido! Pronto para ajudar como assistente do Classic Poms Kennel.' }] });
}
if (payload.messages) {
  payload.messages.forEach(msg => {
    // Pula mensagens com conteúdo complexo (tool_result etc)
    var textContent = '';
    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (!textContent) textContent = JSON.stringify(msg.content);
    }
    if (textContent) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: textContent }]
      });
    }
  });
}

// Ferramentas
let tools = undefined;
if (payload.tools && payload.tools.length > 0) {
  try {
    tools = [{ functionDeclarations: payload.tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    }))}];
  } catch(e) { tools = undefined; }
}

const geminiPayload = {
  contents,
  generationConfig: { maxOutputTokens: payload.max_tokens || 1024, temperature: 0.7 }
};
if (tools) geminiPayload.tools = tools;

const postData = JSON.stringify(geminiPayload);
const model = 'gemini-1.5-flash-latest';
const apiPath = `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: apiPath, method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
};

const apiReq = https.request(options, (apiRes) => {
  let data = '';
  apiRes.on('data', chunk => { data += chunk; });
  apiRes.on('end', () => {
    try {
      const geminiResp = JSON.parse(data);

      // Se Gemini retornou erro, repassa com detalhes
      if (geminiResp.error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro do Gemini: ' + geminiResp.error.message, code: geminiResp.error.code }));
        return;
      }

      const candidate = geminiResp.candidates && geminiResp.candidates[0];
      if (!candidate) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sem candidatos na resposta', raw: JSON.stringify(geminiResp).slice(0,300) }));
        return;
      }

      const content = [];
      const parts = (candidate.content && candidate.content.parts) || [];
      parts.forEach(part => {
        if (part.text) content.push({ type: 'text', text: part.text });
        if (part.functionCall) content.push({
          type: 'tool_use', id: 'tool_' + Date.now(),
          name: part.functionCall.name, input: part.functionCall.args || {}
        });
      });

      if (!content.length) {
        // Blocked or empty
        const reason = candidate.finishReason || 'UNKNOWN';
        content.push({ type: 'text', text: 'Desculpe, não consegui processar essa pergunta. (motivo: ' + reason + ')' });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        content,
        stop_reason: parts.some(p => p.functionCall) ? 'tool_use' : 'end_turn',
        model
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro ao processar: ' + e.message, raw: data.slice(0, 300) }));
    }
  });
});

apiReq.on('error', e => {
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Erro de conexão: ' + e.message }));
});

apiReq.write(postData);
apiReq.end();
```

});
});

server.listen(PORT, () => console.log(`Classic Proxy (Gemini) rodando na porta ${PORT}`));
