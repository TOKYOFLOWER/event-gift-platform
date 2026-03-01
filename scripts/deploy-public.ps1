# scripts/deploy-public.ps1
# Public WebApp デプロイスクリプト
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$PublicDir = "$Root\src\public"
$SharedDst = "$PublicDir\shared"

Write-Host "==> [1/5] shared/ を src/public/shared/ にコピー"
if (Test-Path $SharedDst) { Remove-Item -Recurse -Force $SharedDst }
Copy-Item -Recurse "$Root\src\shared" $SharedDst

Write-Host "==> [2/5] .clasp.json を public 用に切り替え"
Copy-Item -Force "$Root\.clasp-public.json" "$Root\.clasp.json"

Write-Host "==> [3/5] clasp push"
Set-Location $Root
clasp push --force

Write-Host "==> [4/5] clasp deploy"
$desc = "public-$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')"
clasp deploy --description $desc

Write-Host "==> [5/5] コピーした shared/ を削除"
Remove-Item -Recurse -Force $SharedDst
Remove-Item -Force "$Root\.clasp.json" -ErrorAction SilentlyContinue

Write-Host "✅ Public WebApp デプロイ完了"
