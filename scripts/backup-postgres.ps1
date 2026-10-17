param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\backups')
)

$databaseUrl = $env:DATABASE_URL
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw 'DATABASE_URL is not set. Set it only for this PowerShell session before running the backup.'
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw 'pg_dump was not found. Install PostgreSQL client tools before running this script.'
}

if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw 'pg_restore was not found. Install PostgreSQL client tools before running this script.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $OutputDirectory "oneelo-$timestamp.dump"

& pg_dump --format=custom --file $backupPath --dbname $databaseUrl
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
  throw "pg_dump failed with exit code $LASTEXITCODE."
}

& pg_restore --list $backupPath *> $null
if ($LASTEXITCODE -ne 0) {
  throw "The generated backup could not be read by pg_restore (exit code $LASTEXITCODE)."
}

Write-Host "Backup created and validated: $backupPath"
