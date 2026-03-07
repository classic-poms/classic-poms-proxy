const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const server = http.createServer((req, res) => {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Rota de Teste (Health Check)
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'Classic Proxy (Gemini) online 🐾' }));
        return;
    }

    // Rota Principal do Chat
    if (req.method !== 'POST' || req.url !== '/chat') {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        let payload;
        try {
            payload = JSON.parse(body);
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
            return;
        }

        // Converte formato Anthropic → Gemini
        const contents = [];
        if (payload.system) {
            contents.push({ role: 'user', parts: [{ text: '### INSTRUÇÕES DO SISTEMA ###\n' + payload.system }] });
            contents.push({ role: 'model', parts: [{ text: 'Entendido! Pronto para ajudar como assistente do Classic Poms Kennel.' }] });
        }
        
        if (payload.messages) {
            payload.messages.forEach(msg => {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
                });
            });
        }

        // Configuração de Ferramentas (Tools)
        let tools = undefined;
        if (payload.tools && payload.tools.length > 0) {
            tools = [{
                functionDeclarations: payload.tools.map(t => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.input_schema
                }))
            }];
        }

        const geminiPayload = {
            contents,
            generationConfig: {
                maxOutputTokens: payload.max_tokens || 1024,
                temperature: 0.7
            }
        };
        if (tools) geminiPayload.tools = tools;

        const postData = JSON.stringify(geminiPayload);
        const model = 'gemini-1.5-flash-latest';
        const path = `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const apiReq = https.request(options, (apiRes) => {
            let data = '';
            apiRes.on('data', chunk => { data += chunk; });
            apiRes.on('end', () => {
                try {
                    const geminiResp = JSON.parse(data);
                    
                    if (geminiResp.error) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'Erro na API Google', details: geminiResp.error }));
                        return;
                    }

                    const candidate = geminiResp.candidates && geminiResp.candidates[0];
                    if (!candidate) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'Sem resposta da IA', raw: geminiResp }));
                        return;
                    }

                    const content = [];
                    const parts = (candidate.content && candidate.content.parts) || [];
                    
                    parts.forEach(part => {
                        if (part.text) {
                            content.push({ type: 'text', text: part.text });
                        }
                        if (part.functionCall) {
                            content.push({
                                type: 'tool_use',
                                id: 'tool_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                name: part.functionCall.name,
                                input: part.functionCall.args || {}
                            });
                        }
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        content,
                        stop_reason: parts.some(p => p.functionCall) ? 'tool_use' : 'end_turn',
                        model
                    }));
                } catch (e) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'Erro ao processar resposta: ' + e.message }));
                }
            });
        });

        apiReq.on('error', e => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Erro na requisição: ' + e.message }));
        });

        apiReq.write(postData);
        apiReq.end();
    });
});

server.listen(PORT, () => console.log(`Classic Proxy (Gemini) rodando na porta ${PORT}`));
