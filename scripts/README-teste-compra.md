# Testar compra (Hotmart → Apps Script → Firestore)

## Opção A — Reenviar na Hotmart (mais fácil)

1. [app-postback.hotmart.com](https://app-postback.hotmart.com) → **Histórico**
2. Abra o POST **Compra aprovada** com status **200**
3. Clique em **Reenviar**
4. Firebase → Firestore → `email_access` → confira o e-mail do comprador

## Opção B — Script local (simula compra)

1. Copie `webhook-secrets.example.ps1` → `webhook-secrets.ps1`
2. Preencha URL `/exec` do Apps Script e o **Hottok**
3. No PowerShell, na pasta do projeto:

```powershell
. .\scripts\webhook-secrets.ps1
.\scripts\test-hotmart-webhook.ps1 -Email "teste.compra@example.com"
```

4. Resposta esperada: `{"ok":true,"action":"granted","email":"teste.compra@example.com"}`
5. Firestore → `email_access/teste.compra@example.com` → `active: true`

## Opção C — Testar login no site

1. Após `email_access` criado, abra https://saasacademy.vercel.app
2. **Entrar** → e-mail do teste → **Verificar** → senha → **Entrar no laboratório**
