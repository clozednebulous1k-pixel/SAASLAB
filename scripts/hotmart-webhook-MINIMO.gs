/**
 * TESTE 1 — Cole SOZINHO no script.google.com (apague tudo antes).
 * Implantar > Nova implantacao > App da Web > Qualquer pessoa.
 * Abra a URL /exec no navegador: deve mostrar "OK Hotmart webhook"
 * Depois troque pelo arquivo hotmart-webhook.gs completo + Nova versao.
 */
function doGet() {
  return ContentService.createTextOutput('OK Hotmart webhook');
}

function doPost(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, test: true, message: 'doPost funcionando' })
  ).setMimeType(ContentService.MimeType.JSON);
}
