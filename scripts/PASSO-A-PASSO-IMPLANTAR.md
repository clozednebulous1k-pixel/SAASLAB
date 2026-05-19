# doPost nao encontrado — implantar do zero (10 min)

O erro **"Funcao de script nao encontrada: doPost"** = a URL `/exec` aponta para um projeto **sem** as funcoes `doGet` e `doPost`.

---

## Caminho A — Projeto novo (recomendado se travou)

### 1. Novo projeto

1. [script.google.com](https://script.google.com) → **Novo projeto**
2. Nome: `Hotmart SaaS Academy v2`
3. Apague **tudo** no editor
4. Cole **somente** o conteudo de `scripts/hotmart-webhook-MINIMO.gs`
5. **Salvar** (Ctrl+S)

### 2. Primeira implantacao

1. **Implantar** → **Nova implantacao**
2. Tipo: **App da web**
3. Descricao: `webhook v1`
4. Executar como: **Eu**
5. Quem tem acesso: **Qualquer pessoa**
6. **Implantar** → autorize se pedir
7. **Copie a URL** que termina em `/exec` (sera DIFERENTE da antiga)

### 3. Teste no navegador

Cole a **nova** URL no Chrome. Tem que aparecer **somente**:

```
OK Hotmart webhook
```

Se aparecer erro doGet → codigo nao foi salvo ou implantacao errada.

### 4. Teste POST no PowerShell

Use a **URL NOVA**:

```powershell
cd c:\Users\User\APRENDASAAS

.\scripts\test-hotmart-webhook.ps1 `
  -WebhookUrl "COLE_A_URL_NOVA_AQUI/exec" `
  -Hottok "SEU_HOTTOK" `
  -Email "aluno.teste.saasacademy@gmail.com"
```

Esperado (versao MINIMA): `{"ok":true,"test":true,"message":"doPost funcionando"}`

### 5. Codigo completo + Firestore

1. No mesmo projeto, apague o minimo
2. Cole `scripts/hotmart-webhook.gs` inteiro
3. Propriedades do script: `FIREBASE_PROJECT_ID`, `HOTTOK`, `SERVICE_ACCOUNT_JSON`
4. **Implantar** → **Gerenciar implantacoes** → **lapis** → **Nova versao** → Implantar
5. Navegador `/exec` ainda mostra `OK Hotmart webhook`
6. PowerShell de novo → esperado: `"action":"granted"`

### 6. Atualizar Hotmart

Webhook URL = `https://script.google.com/.../exec?hottok=SEU_TOKEN`

(use a URL **nova** se criou projeto novo)

---

## Caminho B — Mesmo projeto (URL antiga)

So use se tiver certeza que esta no projeto certo.

1. Abra o projeto cuja implantacao tem ID `AKfycbwtq0pgdNa3Zha8JSbmT-wEduCFP0negVCCBLrQk08CH7MzyViCxaxDur0aFcoRP7Jh`
   - Em cada projeto: **Implantar** → **Gerenciar implantacoes** → compare a URL
2. Cole `hotmart-webhook-MINIMO.gs` → Salvar
3. **Gerenciar implantacoes** → linha App da web → **lapis**
4. **Versao: Nova versao** (nao so Salvar)
5. **Implantar**
6. Teste URL no navegador

---

## Erros comuns

| Erro | Causa |
|------|--------|
| doGet/doPost nao encontrado | Codigo nao colado OU nao fez Nova versao |
| URL antiga no PowerShell | Implantou projeto novo mas testou URL velha |
| JSON granted nao aparece | Falta SERVICE_ACCOUNT_JSON no script completo |
| Firestore 403 | Conta de servico sem papel Cloud Datastore User |

---

## Checklist final

- [ ] Navegador em `/exec` → `OK Hotmart webhook`
- [ ] PowerShell → JSON com `ok: true`
- [ ] Firestore → `email_access` → e-mail do teste → `active: true`
- [ ] Site → Entrar → mesmo e-mail → Verificar → login OK
