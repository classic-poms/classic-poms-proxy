# 🚀 Como colocar o Classic AI no ar (gratuito)

## O que você vai fazer
Criar um pequeno servidor gratuito no Render que faz a ponte entre o app e a IA.
**Tempo estimado: 10 minutos.**

---

## PASSO 1 — Criar conta na Anthropic (pegar a chave da IA)

1. Acesse: **https://console.anthropic.com**
2. Clique em **"Sign up"** e crie uma conta gratuita
3. No menu esquerdo, clique em **"API Keys"**
4. Clique em **"Create Key"**
5. Dê o nome: `classic-poms`
6. **Copie a chave** (começa com `sk-ant-...`) — guarde em lugar seguro!

> 💡 A Anthropic dá crédito grátis para novos usuários. Uma conversa com o Classic custa menos de R$ 0,01.

---

## PASSO 2 — Colocar os arquivos no GitHub

1. Acesse: **https://github.com** e crie uma conta (se não tiver)
2. Clique em **"New repository"**
3. Nome: `classic-poms-proxy`
4. Marque **"Public"**
5. Clique **"Create repository"**
6. Na página seguinte, clique em **"uploading an existing file"**
7. Arraste os 2 arquivos: `server.js` e `package.json`
8. Clique **"Commit changes"**

---

## PASSO 3 — Criar o servidor no Render (gratuito)

1. Acesse: **https://render.com** e crie uma conta com seu GitHub
2. Clique em **"New +"** → **"Web Service"**
3. Clique em **"Connect"** ao lado do repositório `classic-poms-proxy`
4. Preencha:
   - **Name:** `classic-poms-proxy`
   - **Region:** Ohio (US East) ou qualquer um
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** *(deixar em branco)*
   - **Start Command:** `node server.js`
   - **Instance Type:** **Free** ✓
5. Role para baixo até **"Environment Variables"**
6. Clique **"Add Environment Variable"**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: *cole aqui a chave que você copiou no Passo 1*
7. Clique **"Create Web Service"**
8. Aguarde 2-3 minutos até aparecer **"Live"** em verde
9. **Copie a URL** do seu servidor (ex: `https://classic-poms-proxy.onrender.com`)

---

## PASSO 4 — Atualizar o app com a URL do servidor

No arquivo `classic-poms.html`, procure a linha:
```
var PROXY_URL = (window.CLASSIC_PROXY_URL || 'https://classic-poms-proxy.onrender.com') + '/chat';
```

Se a URL do seu servidor for diferente de `classic-poms-proxy.onrender.com`, substitua pelo endereço que o Render gerou para você.

Depois faça o upload do `classic-poms.html` atualizado no Netlify normalmente.

---

## PASSO 5 — Testar

1. Abra o app no celular
2. Toque no botão 🐾 (Classic)
3. Digite: **"Quais filhotes estão disponíveis?"**
4. O Classic deve responder em 2-3 segundos ✅

---

## ⚠️ Aviso importante sobre o plano gratuito do Render

O servidor gratuito do Render "dorme" após 15 minutos sem uso. Na primeira mensagem depois de um período inativo, pode demorar **20-30 segundos** para responder (ele está "acordando"). As mensagens seguintes serão rápidas normalmente.

**Solução:** Se isso incomodar, você pode fazer upgrade para o plano Starter do Render por US$ 7/mês, que mantém o servidor sempre ativo.

---

## ❓ Problemas?

Me mande uma mensagem com o erro que aparecer que eu resolvo!
