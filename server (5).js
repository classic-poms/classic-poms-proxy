const https = require('https');
const http = require('http');
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', model: 'gemini-2.0-flash', key_ok: !!GEMINI_API_KEY }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/chat') {
    res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' })); return;
  }
  if (!GEMINI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Chave nao configurada' })); return;
  }

  var body = '';
  req.on('data', function(chunk) { body += chunk.toString(); });
  req.on('end', function() {
    var payload;
    try { payload = JSON.parse(body); }
    catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'JSON invalido' })); return; }

    // Converte mensagens para formato Gemini
    var contents = [];
    if (payload.system) {
      contents.push({ role: 'user', parts: [{ text: payload.system }] });
      contents.push({ role: 'model', parts: [{ text: 'Entendido!' }] });
    }
    if (payload.messages) {
      payload.messages.forEach(function(msg) {
        var txt = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        if (txt) contents.push({
          role: (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user',
          parts: [{ text: txt }]
        });
      });
    }

    // Converte tools do formato Anthropic para formato Gemini
    var geminiPayload = {
      contents: contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
    };

    if (payload.tools && payload.tools.length > 0) {
      var functionDeclarations = payload.tools.map(function(tool) {
        var props = {};
        var required = tool.input_schema && tool.input_schema.required || [];
        if (tool.input_schema && tool.input_schema.properties) {
          Object.keys(tool.input_schema.properties).forEach(function(key) {
            var p = tool.input_schema.properties[key];
            props[key] = { type: p.type ? p.type.toUpperCase() : 'STRING', description: p.description || '' };
            if (p.enum) props[key].enum = p.enum;
          });
        }
        return {
          name: tool.name,
          description: tool.description || '',
          parameters: { type: 'OBJECT', properties: props, required: required }
        };
      });
      geminiPayload.tools = [{ functionDeclarations: functionDeclarations }];
    }

    var postData = JSON.stringify(geminiPayload);
    var model = 'gemini-2.0-flash';
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
            res.end(JSON.stringify({ error: r.error.message })); return;
          }

          var candidate = r.candidates && r.candidates[0];
          var parts = (candidate && candidate.content && candidate.content.parts) || [];

          // Converte resposta Gemini para formato Anthropic
          var contentBlocks = [];
          parts.forEach(function(p) {
            if (p.text) {
              contentBlocks.push({ type: 'text', text: p.text });
            } else if (p.functionCall) {
              // Converte functionCall do Gemini para tool_use do Anthropic
              contentBlocks.push({
                type: 'tool_use',
                id: 'tool_' + Date.now(),
                name: p.functionCall.name,
                input: p.functionCall.args || {}
              });
            }
          });

          if (contentBlocks.length === 0) {
            contentBlocks.push({ type: 'text', text: 'Sem resposta.' });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content: contentBlocks, stop_reason: 'end_turn', model: model }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    apiReq.on('error', function(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    apiReq.write(postData);
    apiReq.end();
  });
});

server.listen(PORT, function() { console.log('Proxy Classic Poms porta ' + PORT); });
