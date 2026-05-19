# Teste único: Hotmart → Firebase → login

Objetivo: **uma vez** provar que a compra (ou POST de teste) cria `email_access` e o cliente entra no site.

---

## Parte A — Preparar o Apps Script (só na 1ª vez)

### A1. Código

1. [script.google.com](https://script.google.com) → projeto da URL `/exec`
2. Apague tudo → cole **`scripts/hotmart-webhook.gs`** do repositório
3. **Salvar**

### A2. Propriedades do script

**Projeto** → **Configurações do projeto** → **Propriedades do script**:

| Nome | Valor |
|------|--------|
| `FIREBASE_PROJECT_ID` | `devserver-4d2c8` |
| `HOTTOK` | Token da Hotmart (aba Autenticação do webhook) |
| `SERVICE_ACCOUNT_JSON` | JSON da conta de serviço Google Cloud (uma linha) |

Conta de serviço: [Google Cloud](https://console.cloud.google.com) → IAM → Contas de serviço → criar → chave JSON → papel **Cloud Datastore User**.

### A3. Implantar

**Implantar** → **Nova implantação** → **App da Web** → Executar como **Eu** → **Qualquer pessoa**.

### A4. Conferir

Abra no navegador a URL `/exec` → deve aparecer:

`OK Hotmart webhook`

Se aparecer **doGet/doPost não encontrado**, o código não foi salvo ou não fez **Nova implantação**.

---

## Parte B — Um único disparo de teste

Escolha **uma** opção.

### Opção 1 — PowerShell (simula 1 compra)

Na raiz `APRENDASAAS`:

```powershell
.\scripts\test-hotmart-webhook.ps1 `
  -WebhookUrl "SUA_URL/exec" `
  -Hottok "SEU_HOTTOK" `
  -Email "cliente@gmail.com"
```

**Sucesso:** `{"ok":true,"action":"granted","email":"cliente@gmail.com"}`

### Opção 2 — Hotmart real

1. Webhook configurado com a mesma URL `/exec?hottok=...`
2. Uma compra de teste **ou** Histórico → **Reenviar** em “Compra aprovada”
3. Histórico deve mostrar **200** e corpo com `"action":"granted"`

---

## Parte C — Confirmar Firebase (30 segundos)

1. [Firebase Console](https://console.firebase.google.com) → **devserver-4d2c8**
2. **Firestore** → `email_access` → documento **`cliente@gmail.com`**
3. Campo **`active`** = **true**

Se não existir → o Apps Script falhou (veja resposta do POST ou Executar → `grantAccessTest` no editor).

---

## Parte D — Confirmar login no site (30 segundos)

1. https://saasacademy.vercel.app → **Entrar**
2. E-mail: **`cliente@gmail.com`** (o mesmo do teste)
3. **Verificar** → deve indicar acesso liberado
4. Senha (1ª vez) ou Google → entra no laboratório

---

## Se algo falhar

| Sintoma | Causa provável |
|---------|----------------|
| doPost não encontrado | Código não colado / deploy antigo |
| `SERVICE_ACCOUNT_JSON missing` | Propriedade vazia no Apps Script |
| `Firestore 403` | Conta de serviço sem papel no projeto |
| `invalid hottok` | HOTTOK ≠ token Hotmart |
| Site não libera | E-mail do login ≠ e-mail do webhook |
| `permission-denied` no site | Regras Firestore não publicadas |

---

## Depois do teste OK

Não precisa simular de novo. Compras reais na Hotmart disparam o webhook sozinhas e gravam `email_access` automaticamente.
