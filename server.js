const https = require(‘https’);
const http = require(‘http’);

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const server = http.createServer(function(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS, GET’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);

```
if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', key_ok: !!GEMINI_API_KEY }));
    return;
}

if (req.method !== 'POST' || req.url !== '/chat') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
}

if (!GEMINI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Chave GEMINI_API_KEY nao configurada' }));
    return;
}

var body = '';
req.on('data', function(chunk) { body += chunk.toString(); });
req.on('end', function() {
    var payload;
    try { payload = JSON.parse(body); }
    catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'JSON invalido' })); return; }

    var contents = [];

    if (payload.system) {
        contents.push({ role: 'user', parts: [{ text: 'INSTRUCOES: ' + payload.system }] });
        contents.push({ role: 'model', parts: [{ text: 'Entendido!' }] });
    }

    if (payload.messages) {
        payload.messages.forEach(function(msg) {
            var txt = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
            if (txt) {
                contents.push({
                    role: (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user',
                    parts: [{ text: txt }]
                });
            }
        });
    }

    var postData = JSON.stringify({
        contents: contents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
    });

    var model = 'gemini-1.5-flash';
    var options = {
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/' + model + ':generateContent?key=' + GEMINI_API_KEY,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };

    var apiReq = https.request(options, function(apiRes) {
        var data = '';
        apiRes.on('data', function(chunk) { data += chunk; });
        apiRes.on('end', function() {
            try {
                var r = JSON.parse(data);
                if (r.error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Erro Gemini: ' + r.error.message }));
                    return;
                }
                var candidate = r.candidates && r.candidates[0];
                var parts = (candidate && candidate.content && candidate.content.parts) || [];
                var text = parts.map(function(p) { return p.text || ''; }).join('') || 'Sem resposta.';
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ content: [{ type: 'text', text: text }], model: model }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Erro: ' + e.message }));
            }
        });
    });

    apiReq.on('error', function(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro conexao: ' + e.message }));
    });

    apiReq.write(postData);
    apiReq.end();
});
```

});

server.listen(PORT, function() { console.log(’Proxy Classic Poms porta ’ + PORT); });
