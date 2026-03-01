# deploy-admin.ps1: shared/ を admin/ にコピーして clasp push & deploy
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

Write-Host "==> Copying shared/ to src/admin/shared/"
Copy-Item -Recurse -Force "$Root\src\shared" "$Root\src\admin\shared"

Write-Host "==> clasp push (Admin)"
Copy-Item -Force "$Root\.clasp-admin.json" "$Root\.clasp.json"
Set-Location $Root
clasp push

Write-Host "==> clasp deploy (Admin)"
$ts = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
clasp deploy --description $ts

Write-Host "==> Cleaning up"
Remove-Item -Recurse -Force "$Root\src\admin\shared"
Write-Host "==> Done: Admin WebApp deployed"
