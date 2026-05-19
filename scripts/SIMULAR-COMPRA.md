# Simular compra → liberar e-mail no Firestore

A Hotmart **não envia e-mail para o Firebase Auth**. O que libera o cliente é um documento na coleção **`email_access`**:

| Campo   | Valor                          |
|---------|--------------------------------|
| ID doc  | e-mail em minúsculas (ex. `cliente@gmail.com`) |
| `active`| `true`                         |
| `email` | mesmo e-mail                   |

O site lê isso em **Verificar** / login (`auth-access.js`).

---

## Forma 1 — Console Firestore (mais rápida, igual `cliente@gmail.com`)

1. [Firebase Console](https://console.firebase.google.com) → projeto **devserver-4d2c8**
2. **Firestore Database** → **Iniciar coleção** (se não existir) ou abra **`email_access`**
3. **Adicionar documento**
   - **ID do documento:** `cliente@gmail.com` (ou o e-mail de teste, **minúsculas**)
   - Campos:
     - `active` → boolean → **true**
     - `email` → string → `cliente@gmail.com`
4. **Salvar**
5. No site: **Entrar** → digite o **mesmo e-mail** → **Verificar** → senha ou Google

---

## Forma 2 — Painel admin no site (dono logado)

Requisitos: `PRIMARY_ADMIN_UID` e `ownerUid()` com **o mesmo UID** seu; regras publicadas.

1. Deploy do site com `js/owner-config.js` atualizado
2. Entrar com a conta dono (UID = o configurado)
3. **Painel admin** → liberar pelo e-mail do cliente

Isso grava `email_access` + `libraryAccess` no `users/{uid}` se o usuário já existir.

---

## Forma 3 — Webhook (simular Hotmart)

Só funciona se o **Google Apps Script** tiver `doPost` + propriedades `HOTTOK`, `SERVICE_ACCOUNT_JSON`, etc.

Na **raiz** do projeto:

```powershell
cd c:\Users\User\APRENDASAAS

.\scripts\test-hotmart-webhook.ps1 `
  -WebhookUrl "https://script.google.com/macros/s/SEU_ID/exec" `
  -Hottok "SEU_HOTTOK" `
  -Email "cliente@gmail.com"
```

Resposta esperada: `{"ok":true,"action":"granted","email":"cliente@gmail.com"}`

Se aparecer **doPost não encontrado** → cole o código em `scripts/hotmart-webhook.gs` no script.google.com e faça **Nova implantação**.

---

## Checklist depois de simular

- [ ] Firestore → `email_access` → documento com o e-mail → `active: true`
- [ ] Site → mesmo e-mail → **Verificar** → mensagem de acesso liberado
- [ ] Login com senha ou Google → entra no laboratório

---

## O que NÃO é

- Não é e-mail de confirmação do Firebase (isso é só “esqueci senha”)
- Não cria usuário no Authentication sozinho — o cliente **entra** e aí cria senha/Google
