$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "seed_phase3.sql"

Write-Host "Boli.pk — Phase 3 seed data" -ForegroundColor Cyan
Write-Host "Running $sqlFile against boli-postgres-1 ..." -ForegroundColor Gray

Get-Content $sqlFile | docker exec -i boli-postgres-1 psql -U boli -d boli

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSeed completed successfully." -ForegroundColor Green
} else {
    Write-Host "`nSeed failed — check output above." -ForegroundColor Red
}
