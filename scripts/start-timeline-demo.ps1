param([int]$Port = 3127)

$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot
$env:WIKI_WORKSPACE_DIR = Join-Path $repoRoot 'demo-data'
node node_modules/vitest/vitest.mjs run --config scripts/vitest.demo.config.mts
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node node_modules/next/dist/bin/next dev --port $Port
