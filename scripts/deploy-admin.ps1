# scripts/deploy-admin.ps1
# Admin WebApp デプロイスクリプト
# 使い方: .\scripts\deploy-admin.ps1
# 注意: clasp login 済みであること
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$AdminDir = "$Root\src\admin"
$SharedDst = "$AdminDir\shared"

Write-Host "==> [1/5] shared/ を src/admin/shared/ にコピー"
if (Test-Path $SharedDst) { Remove-Item -Recurse -Force $SharedDst }
Copy-Item -Recurse "$Root\src\shared" $SharedDst

Write-Host "==> [2/5] .clasp.json を admin 用に切り替え"
Copy-Item -Force "$Root\.clasp-admin.json" "$Root\.clasp.json"

Write-Host "==> [3/5] clasp push"
Set-Location $Root
clasp push --force

Write-Host "==> [4/5] clasp deploy"
$desc = "admin-$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')"
clasp deploy --description $desc

Write-Host "==> [5/5] コピーした shared/ を削除"
Remove-Item -Recurse -Force $SharedDst
Remove-Item -Force "$Root\.clasp.json" -ErrorAction SilentlyContinue

Write-Host "✅ Admin WebApp デプロイ完了"
