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

if ($Hottok -match 'seu_hottok|exemplo|placeholder' -or $Hottok.Length -lt 10) {
  Fail "Hottok invalido ou ainda e o texto de exemplo. Copie o token da aba Autenticacao na Hotmart."
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
Write-Host "Confira: Firebase -> Firestore -> email_access -> $Email (active: true)" -ForegroundColor Cyan
