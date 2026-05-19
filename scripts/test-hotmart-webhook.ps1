# Simula postback Hotmart 2.0 (compra aprovada) para o Google Apps Script
#
# Uso (substitua URL e Hottok REAIS):
#   .\scripts\test-hotmart-webhook.ps1 `
#     -WebhookUrl "https://script.google.com/macros/s/AKfycb.../exec" `
#     -Hottok "f2sF97S4gtDTwQdY6D6t..." `
#     -Email "teste.compra@example.com"

param(
  [string]$WebhookUrl = $env:HOTMART_WEBHOOK_URL,
  [string]$Hottok = $env:HOTMART_HOTTOK,
  [string]$Email = "teste.compra.saasacademy@example.com"
)

function Fail([string]$msg) {
  Write-Host "ERRO: $msg" -ForegroundColor Red
  exit 1
}

if (-not $WebhookUrl) {
  Fail @"
Defina a URL do Apps Script (termina em /exec).

Copie em script.google.com -> Implantar -> Gerenciar implantacoes -> URL do App da Web.

Exemplo:
  .\scripts\test-hotmart-webhook.ps1 -WebhookUrl "https://script.google.com/macros/s/SEU_ID_REAL/exec" -Hottok "SEU_HOTTOK"
"@
}

$WebhookUrl = $WebhookUrl.Trim().Trim('"', "'")
$Hottok = $(if ($Hottok) { $Hottok.Trim().Trim('"', "'") } else { "" })

if ($WebhookUrl -notmatch '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec') {
  Fail "URL invalida: '$WebhookUrl'. Use a URL completa do Apps Script (nao use 'cd' nem texto de exemplo SEU_DEPLOY_ID)."
}

if ($WebhookUrl -match 'SEU_DEPLOY|SEU_ID|example|placeholder') {
  Fail "Voce ainda esta com a URL de EXEMPLO. Cole a URL real do Implantar do Apps Script."
}

if (-not $Hottok) {
  Fail "Defina o Hottok (Hotmart -> Webhook -> aba Autenticacao)."
}

if ($Hottok -match 'seu_hottok|exemplo|placeholder|TOKEN_DA|COLE_O|ABA_AUTENTICACAO|script\.google') {
  Fail "Voce colou o TEXTO DE EXEMPLO, nao o token real. Hotmart -> Webhook -> Autenticacao -> copie o codigo longo (ex: f2sF97S4-...)."
}
if ($Hottok.Length -lt 20) {
  Fail "Hottok muito curto. O token da Hotmart e longo (UUID). Nao use URL do Apps Script no campo HOTTOK."
}

$uri = $WebhookUrl
$sep = if ($uri -match '\?') { '&' } else { '?' }
$uri = "$uri${sep}hottok=$([uri]::EscapeDataString($Hottok))"

$body = @{
  event = "PURCHASE_APPROVED"
  data  = @{
    buyer    = @{ email = $Email }
    product  = @{ id = "0"; name = "SaaSAcademy test" }
    purchase = @{
      transaction = "HP-TEST-" + (Get-Date -Format "yyyyMMddHHmmss")
      status      = "APPROVED"
    }
  }
} | ConvertTo-Json -Depth 6

Write-Host "POST $WebhookUrl?hottok=..." -ForegroundColor DarkGray
Write-Host "Email: $Email"
Write-Host ""

try {
  $resp = Invoke-WebRequest -Uri $uri -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
  Write-Host "HTTP $($resp.StatusCode)" -ForegroundColor Green
  Write-Host $resp.Content
  if ($resp.Content -match 'doPost|doGet|script n.o encontrada') {
    Write-Host ""
    Write-Host "BLOQUEIO: Apps Script sem codigo ativo na URL /exec." -ForegroundColor Red
    Write-Host "Abra a URL no navegador - deve mostrar: OK Hotmart webhook" -ForegroundColor Yellow
    Write-Host "Guia: scripts/CONSERTAR-APPS-SCRIPT.md" -ForegroundColor Yellow
    exit 1
  }
  if ($resp.Content -match 'invalid hottok') {
    Write-Host ""
    Write-Host "HOTTOK diferente: copie o token da Hotmart (Autenticacao) para Propriedades do script HOTTOK no Apps Script." -ForegroundColor Yellow
    Write-Host "Use o MESMO valor no -Hottok deste comando e na URL do webhook." -ForegroundColor Yellow
    exit 1
  }
  if ($resp.Content -match 'SERVICE_ACCOUNT_JSON missing') {
    Write-Host ""
    Write-Host "Cole o JSON da conta de servico em Propriedades do script -> SERVICE_ACCOUNT_JSON" -ForegroundColor Yellow
    exit 1
  }
  if ($resp.Content -notmatch '"ok"\s*:\s*true') {
    Write-Host ""
    Write-Host "Resposta nao indica sucesso. Veja o JSON acima (email not found, Firestore 403, etc.)." -ForegroundColor Yellow
  }
} catch {
  $r = $_.Exception.Response
  if ($r) {
    $reader = New-Object System.IO.StreamReader($r.GetResponseStream())
    $text = $reader.ReadToEnd()
    Write-Host "HTTP $([int]$r.StatusCode)" -ForegroundColor Red
    if ($text.Length -gt 400) { $text = $text.Substring(0, 400) + "..." }
    Write-Host $text
    if ([int]$r.StatusCode -eq 404) {
      Write-Host ""
      Write-Host "404 = URL do Apps Script errada ou implantacao removida. Copie de novo em Implantar -> /exec" -ForegroundColor Yellow
    }
  } else {
    Write-Host $_.Exception.Message -ForegroundColor Red
  }
  exit 1
}

Write-Host ""
Write-Host ("Confira Firestore: email_access / " + $Email + " / active=true") -ForegroundColor Cyan
