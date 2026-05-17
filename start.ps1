# SaaS Lab — servidor local
$ErrorActionPreference = "Stop"
$port = 8765
$root = $PSScriptRoot

Set-Location $root

function Find-Python {
  foreach ($cmd in @("python", "py", "python3")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
      return $cmd
    }
  }
  return $null
}

$python = Find-Python
if (-not $python) {
  Write-Host "Python nao encontrado. Instale em https://www.python.org/downloads/" -ForegroundColor Red
  exit 1
}

$url = "http://127.0.0.1:$port/index.html"
Write-Host ""
Write-Host "  SaaS Lab — servidor local" -ForegroundColor Cyan
Write-Host "  $url" -ForegroundColor Green
Write-Host "  Pasta: $root" -ForegroundColor DarkGray
Write-Host "  Ctrl+C para parar" -ForegroundColor DarkGray
Write-Host ""

Start-Process $url
& $python -m http.server $port
