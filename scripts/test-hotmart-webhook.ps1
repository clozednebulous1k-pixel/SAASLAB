# Simula postback Hotmart 2.0 (compra aprovada) para o Google Apps Script
# Uso:
#   $env:HOTMART_WEBHOOK_URL = "https://script.google.com/macros/s/SEU_ID/exec"
#   $env:HOTMART_HOTTOK = "seu_hottok"
#   .\scripts\test-hotmart-webhook.ps1 -Email "teste.compra@example.com"

param(
  [string]$WebhookUrl = $env:HOTMART_WEBHOOK_URL,
  [string]$Hottok = $env:HOTMART_HOTTOK,
  [string]$Email = "teste.compra.saasacademy@example.com"
)

if (-not $WebhookUrl) {
  Write-Host "ERRO: defina HOTMART_WEBHOOK_URL (URL /exec do Apps Script)" -ForegroundColor Red
  Write-Host 'Ex: $env:HOTMART_WEBHOOK_URL = "https://script.google.com/macros/s/xxx/exec"'
  exit 1
}

$uri = $WebhookUrl
if ($Hottok) {
  $sep = if ($uri -match '\?') { '&' } else { '?' }
  $uri = "$uri${sep}hottok=$Hottok"
}

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

Write-Host "POST $uri"
Write-Host "Email: $Email"
Write-Host ""

try {
  $resp = Invoke-WebRequest -Uri $uri -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
  Write-Host "HTTP $($resp.StatusCode)" -ForegroundColor Green
  Write-Host $resp.Content
} catch {
  $r = $_.Exception.Response
  if ($r) {
    $reader = New-Object System.IO.StreamReader($r.GetResponseStream())
    $text = $reader.ReadToEnd()
    Write-Host "HTTP $([int]$r.StatusCode)" -ForegroundColor Red
    Write-Host $text
  } else {
    Write-Host $_.Exception.Message -ForegroundColor Red
  }
  exit 1
}

Write-Host ""
Write-Host "Confira no Firebase: Firestore > email_access > $Email (active: true)" -ForegroundColor Cyan
