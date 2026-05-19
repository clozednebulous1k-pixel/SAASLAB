# Ainda nada? → O Apps Script não está com o código ativo

Testamos sua URL agora. Resposta:

- GET → **Função de script não encontrada: doGet**
- POST → **Função de script não encontrada: doPost**

Ou seja: **Hotmart e PowerShell estão certos**, mas o Google está servindo uma implantação **vazia** (só o `function myFunction() {}` padrão).

---

## Passo 1 — Abrir o projeto CERTO

1. [script.google.com](https://script.google.com)
2. Abra o projeto ligado a esta URL (copie o ID do meio da URL):

   `AKfycbwtq0pgdNa3Zha8JSbmT-wEduCFP0negVCCBLrQk08CH7MzyViCxaxDur0aFcoRP7Jh`

3. Se tiver **vários** projetos, abra cada um → **Implantar** → **Gerenciar implantações** → veja qual tem essa URL.

---

## Passo 2 — Colar o código (arquivo único)

1. No editor, apague **tudo** (inclusive `function myFunction()`).
2. Cole **todo** o conteúdo de `scripts/hotmart-webhook.gs`.
3. **Ctrl+S** (Salvar).
4. No menu superior deve existir a função `doGet` no seletor de funções.

---

## Passo 3 — Propriedades (obrigatório para gravar Firestore)

**Projeto** (ícone engrenagem) → **Configurações do projeto** → aba **Propriedades do script**:

| Propriedade | Exemplo |
|-------------|---------|
| `FIREBASE_PROJECT_ID` | `devserver-4d2c8` |
| `HOTTOK` | token da Hotmart |
| `SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` (JSON inteiro, uma linha) |

Sem `SERVICE_ACCOUNT_JSON`, depois do doPost funcionar você verá erro `SERVICE_ACCOUNT_JSON missing`.

---

## Passo 4 — O que quase todo mundo esquece: NOVA VERSÃO

Só **Salvar** não atualiza a URL `/exec`.

1. **Implantar** → **Gerenciar implantações**
2. Na linha **App da Web**, clique no **lápis** (Editar)
3. Em **Versão**, escolha **Nova versão**
4. **Implantar**

(Alternativa: **Nova implantação** → App da Web → Qualquer pessoa → copie a **nova** URL e atualize na Hotmart.)

---

## Passo 5 — Teste no navegador (obrigatório)

Abra:

https://script.google.com/macros/s/AKfycbwtq0pgdNa3Zha8JSbmT-wEduCFP0negVCCBLrQk08CH7MzyViCxaxDur0aFcoRP7Jh/exec

**Tem que aparecer só isto:**

```
OK Hotmart webhook
```

Se ainda aparecer erro **doGet não encontrado** → voltou ao Passo 2 (código não salvo ou projeto errado).

---

## Passo 6 — Teste Firestore sem Hotmart (no editor)

1. No Apps Script, seletor de função → **`grantAccessTest`**
2. **Executar** → autorize permissões
3. Firebase → Firestore → `email_access` → `cliente@gmail.com` (ou edite o e-mail em `grantAccessTest` no código)

Se isso **não** criar documento → problema é `SERVICE_ACCOUNT_JSON` ou permissão da conta de serviço.

---

## Passo 7 — Um POST de teste (PowerShell)

Só depois do Passo 5 OK:

```powershell
cd c:\Users\User\APRENDASAAS

.\scripts\test-hotmart-webhook.ps1 `
  -WebhookUrl "https://script.google.com/macros/s/AKfycbwtq0pgdNa3Zha8JSbmT-wEduCFP0negVCCBLrQk08CH7MzyViCxaxDur0aFcoRP7Jh/exec" `
  -Hottok "SEU_HOTTOK" `
  -Email "aluno.teste.saasacademy@gmail.com"
```

Sucesso = JSON: `{"ok":true,"action":"granted",...}`

---

## Resumo

| Se no navegador (/exec) | Significa |
|-------------------------|-----------|
| `OK Hotmart webhook` | Código ativo — pode testar POST |
| `doGet não encontrado` | Código não implantado — Passos 2 e 4 |
| JSON `granted` no PowerShell | Firestore deve ter o e-mail |
| `Firestore 403` | Conta de serviço sem permissão |
| `SERVICE_ACCOUNT_JSON missing` | Propriedade vazia |

**Enquanto o Passo 5 não passar, Hotmart nunca vai liberar login automaticamente.**
