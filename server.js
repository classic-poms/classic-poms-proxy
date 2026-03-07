const https = require(‘https’);
const http = require(‘http’);

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const server = http.createServer(function(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

if (req.method === ‘OPTIONS’) { res.writeHead(204); res.end(); return; }

if (req.method === ‘GET’ && req.url === ‘/’) {
res.writeHead(200, { ‘Content-Type’: ‘application/json’ });
res.end(JSON.stringify({ status: ‘Classic Proxy Gemini online’, key_ok: !!GEMINI_API_KEY }));
return;
}

if (req.method !== ‘POST’ || req.url !== ‘/chat’) {
res.writeHead(404);
res.end(JSON.stringify({ error: ‘Not found’ }));
return;
}

if (!GEMINI_API_KEY) {
res.writeHead(500, { ‘Content-Type’: ‘application/json’ });
res.end(JSON.stringify({ error: ‘GEMINI_API_KEY nao configurada!’ }));
return;
}

var body = ‘’;
req.on(‘data’, function(chunk) { body += chunk.toString(); });
req.on(‘end’, function() {
var payload;
try { payload = JSON.parse(body); }
catch (e) {
res.writeHead(400);
res.end(JSON.stringify({ error: ‘Invalid JSON’ }));
return;
}

```
var contents = [];

if (payload.system) {
  contents.push({ role: 'user', parts: [{ text: 'INSTRUCOES DO SISTEMA:\n' + payload.system }] });
  contents.push({ role: 'model', parts: [{ text: 'Entendido! Pronto para ajudar como assistente do Classic Poms Kennel.' }] });
}

if (payload.messages) {
  payload.messages.forEach(function(msg) {
    var textContent = '';
    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content.filter(function(b) { return b.type === 'text'; }).map(function(b) { return b.text; }).join('\n');
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

// Gemini v1 nao suporta tools no mesmo formato - envia sem tools
var geminiPayload = {
  contents: contents,
  generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
};

var postData = JSON.stringify(geminiPayload);
var model = 'gemini-2.0-flash';
var apiPath = '/v1beta/models/' + model + ':generateContent?key=' + GEMINI_API_KEY;

var options = {
  hostname: 'generativelanguage.googleapis.com',
  path: apiPath,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

var apiReq = https.request(options, function(apiRes) {
  var data = '';
  apiRes.on('data', function(chunk) { data += chunk; });
  apiRes.on('end', function() {
    try {
      var geminiResp = JSON.parse(data);

      if (geminiResp.error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro Gemini: ' + geminiResp.error.message }));
        return;
      }

      var candidate = geminiResp.candidates && geminiResp.candidates[0];
      if (!candidate) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sem resposta da IA', raw: JSON.stringify(geminiResp).slice(0, 300) }));
        return;
      }

      var parts = (candidate.content && candidate.content.parts) || [];
      var text = parts.map(function(p) { return p.text || ''; }).join('');

      if (!text) {
        text = 'Desculpe, nao consegui processar. Tente novamente.';
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        content: [{ type: 'text', text: text }],
        stop_reason: 'end_turn',
        model: model
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro: ' + e.message, raw: data.slice(0, 300) }));
    }
  });
});

apiReq.on('error', function(e) {
  res.writeHead(500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Erro conexao: ' + e.message }));
});

apiReq.write(postData);
apiReq.end();
```

});
});

server.listen(PORT, function() {
console.log(’Classic Proxy Gemini rodando na porta ’ + PORT);
});
