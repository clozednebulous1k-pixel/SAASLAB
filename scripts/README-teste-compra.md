# Testar compra (Hotmart → Apps Script → Firestore)

## O erro 404 que você viu

Significa que a URL ainda era **texto de exemplo** (`SEU_DEPLOY_ID`), não a URL real do Apps Script.

O `POST cd?hottok=c:\Users\...` aconteceu porque a variável `HOTMART_WEBHOOK_URL` ficou como `cd` (comando do terminal), não a URL do Google.

---

## Onde pegar a URL real (Apps Script)

1. [script.google.com](https://script.google.com) → projeto **Hotmart SaaS Academy**
2. **Implantar** → **Gerenciar implantações**
3. Copie a URL que termina em **`/exec`** (ex.: `https://script.google.com/macros/s/AKfycbz.../exec`)
4. Abra no navegador → deve aparecer `OK Hotmart webhook`

---

## Onde pegar o Hottok

1. [app-postback.hotmart.com](https://app-postback.hotmart.com)
2. Aba **Autenticação** → copie o token
3. Na configuração do webhook, a URL pode ser:  
   `https://script.google.com/macros/s/SEU_ID/exec?hottok=SEU_TOKEN`

---

## Rodar o teste (PowerShell)

Na pasta do projeto (`c:\Users\User\APRENDASAAS`):

```powershell
.\scripts\test-hotmart-webhook.ps1 `
  -WebhookUrl "COLE_A_URL_EXEC_AQUI" `
  -Hottok "COLE_O_HOTTOK_AQUI" `
  -Email "teste.compra@example.com"
```

**Resposta certa:** HTTP 200 e `{"ok":true,"action":"granted","email":"teste.compra@example.com"}`

**Não use** o arquivo `webhook-secrets.example.ps1` sem editar — ele tem placeholders de propósito.

Opcional: copie para `webhook-secrets.ps1`, edite com valores reais, depois:

```powershell
. "$PSScriptRoot\webhook-secrets.ps1"
.\scripts\test-hotmart-webhook.ps1 -Email "teste.compra@example.com"
```

---

## Opção mais fácil — Reenviar na Hotmart

1. Hotmart → Webhook → **Histórico**
2. POST **Compra aprovada** com **200**
3. **Reenviar**
4. Lupa → corpo com `"action":"granted"`
5. Firestore → `email_access` → e-mail do comprador

---

## Depois: testar login

https://saasacademy.vercel.app → Entrar → mesmo e-mail → Verificar → Entrar no laboratório
