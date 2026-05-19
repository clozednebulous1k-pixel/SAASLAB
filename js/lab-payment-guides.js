/**
 * Conteúdo do passo Pagamentos — opção Hotmart + Apps Script (sem API Vercel).
 */
window.renderHotmartGasPaymentGuide = function renderHotmartGasPaymentGuide() {
  return `
<div class="content-card">
 <div class="content-card-title">Hotmart + Google Apps Script (sem API na Vercel)</div>
 <div class="info-box danger"><strong>Baixa escalabilidade — opção para começar.</strong> A Hotmart envia o webhook para o Google Apps Script, que grava <code>email_access</code> no Firestore. Serve para validar o produto e para volume <strong>moderado</strong> (dezenas ou poucas centenas de vendas/mês). Não é arquitetura para milhares de postbacks por dia.</div>
 <div class="info-box warning"><strong>Limites típicos:</strong> cota de UrlFetch do Apps Script (~20 mil/dia), latência variável, pouca observabilidade. Para escalar: <strong>Firebase Cloud Functions</strong>, API na Vercel ou Make/n8n.</div>
 <div class="info-box success"><strong>Vantagem:</strong> seu site na Vercel continua <strong>100% estático</strong> (HTML + Firebase no navegador). Nenhuma rota <code>/api</code>.</div>
</div>

<div class="content-card">
 <div class="content-card-title">Comparar caminhos</div>
 <div class="code-snippet" style="white-space:pre-wrap;font-size:0.82rem;line-height:1.6">Hotmart manual     → sem API · você libera e-mail
Hotmart + Apps Script → sem API · baixa escala · automático
Stripe / API própria  → com API · alta escala</div>
</div>

<div class="content-card">
 <div class="content-card-title">Passo 1 — Conta de serviço (Google Cloud)</div>
 <ol class="guide-steps">
 <li><a href="https://console.cloud.google.com" target="_blank" rel="noopener">Google Cloud Console</a> → mesmo projeto do Firebase.</li>
 <li>IAM → Contas de serviço → criar → papel <strong>Cloud Datastore User</strong>.</li>
 <li>Chaves → JSON → baixar. Nunca commitar no Git.</li>
 </ol>
</div>

<div class="content-card">
 <div class="content-card-title">Passo 2 — Apps Script</div>
 <ol class="guide-steps">
 <li><a href="https://script.google.com" target="_blank" rel="noopener">script.google.com</a> → cole <code>scripts/hotmart-webhook.gs</code> do repositório.</li>
 <li>Propriedades: <code>FIREBASE_PROJECT_ID</code>, <code>HOTTOK</code> (token Hotmart), <code>SERVICE_ACCOUNT_JSON</code> (JSON inteiro).</li>
 <li>Implantar → App da Web → Qualquer pessoa → URL <code>/exec</code> = <code>OK Hotmart webhook</code> no navegador.</li>
 <li>Após editar código: Gerenciar implantações → Nova versão.</li>
 </ol>
 <div class="lab-path">Arquivos: scripts/hotmart-webhook.gs · hotmart-webhook-MINIMO.gs · TESTE-UNICO-HOTMART-FIREBASE.md</div>
</div>

<div class="content-card">
 <div class="content-card-title">Passo 3 — Hotmart</div>
 <ol class="guide-steps">
 <li><a href="https://app-postback.hotmart.com" target="_blank" rel="noopener">Webhook</a> → Compra aprovada.</li>
 <li>URL: <code>https://script.google.com/.../exec?hottok=SEU_TOKEN</code></li>
 <li>Obrigado: <code>https://SEU-DOMINIO.vercel.app/?acesso=1</code></li>
 </ol>
</div>

<div class="content-card">
 <div class="content-card-title">Passo 4 — Testar uma vez</div>
 <div class="code-snippet">.\\scripts\\test-hotmart-webhook.ps1 \`
  -WebhookUrl "https://script.google.com/.../exec" \`
  -Hottok "TOKEN_DA_HOTMART" \`
  -Email "aluno@teste.com"</div>
 <p style="color:var(--learn-muted);font-size:0.92rem;margin:0.75rem 0 0">Sucesso: <code>{"ok":true,"action":"granted"}</code> → Firestore <code>email_access</code> → login com o mesmo e-mail.</p>
</div>

<div class="content-card">
 <div class="content-card-title">Checklist</div>
 <div class="checklist">
 <label class="check-item"><input type="checkbox" onchange="this.parentElement.classList.toggle('checked',this.checked)"> /exec = OK Hotmart webhook</label>
 <label class="check-item"><input type="checkbox" onchange="this.parentElement.classList.toggle('checked',this.checked)"> HOTTOK igual em todo lugar</label>
 <label class="check-item"><input type="checkbox" onchange="this.parentElement.classList.toggle('checked',this.checked)"> SERVICE_ACCOUNT_JSON completo</label>
 <label class="check-item"><input type="checkbox" onchange="this.parentElement.classList.toggle('checked',this.checked)"> firestore.rules publicadas</label>
 <label class="check-item"><input type="checkbox" onchange="this.parentElement.classList.toggle('checked',this.checked)"> Teste granted + login OK</label>
 </div>
</div>`;
};
