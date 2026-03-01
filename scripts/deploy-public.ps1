# deploy-public.ps1: shared/ を public/ にコピーして clasp push & deploy
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

Write-Host "==> Copying shared/ to src/public/shared/"
Copy-Item -Recurse -Force "$Root\src\shared" "$Root\src\public\shared"

Write-Host "==> clasp push (Public)"
Copy-Item -Force "$Root\.clasp-public.json" "$Root\.clasp.json"
Set-Location $Root
clasp push

Write-Host "==> clasp deploy (Public)"
$ts = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
clasp deploy --description $ts

Write-Host "==> Cleaning up"
Remove-Item -Recurse -Force "$Root\src\public\shared"
Write-Host "==> Done: Public WebApp deployed"
