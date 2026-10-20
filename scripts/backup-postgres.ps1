param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\backups')
)

$databaseUrl = $env:DATABASE_URL
if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
  throw 'DATABASE_URL is not set. Set it only for this PowerShell session before running the backup.'
}

$resolvedOutputDir = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFileName = "oneelo-$timestamp.dump"
$backupPath = Join-Path $resolvedOutputDir $backupFileName

$hasLocalPgTools = (Get-Command pg_dump -ErrorAction SilentlyContinue) -and (Get-Command pg_restore -ErrorAction SilentlyContinue)
$hasDocker = (Get-Command docker -ErrorAction SilentlyContinue)

if ($hasLocalPgTools) {
  & pg_dump --format=custom --file $backupPath --dbname $databaseUrl
  if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
    throw "pg_dump failed with exit code $LASTEXITCODE."
  }

  & pg_restore --list $backupPath *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "The generated backup could not be read by pg_restore (exit code $LASTEXITCODE)."
  }
} elseif ($hasDocker) {
  Write-Host "PostgreSQL client tools (pg_dump/pg_restore) not found in PATH. Using Docker fallback (postgres:17-alpine)..."

  & docker run --rm -v "${resolvedOutputDir}:/backups" postgres:17-alpine pg_dump --format=custom --file "/backups/$backupFileName" --dbname "$databaseUrl"
  if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
    throw "Docker pg_dump failed with exit code $LASTEXITCODE."
  }

  & docker run --rm -v "${resolvedOutputDir}:/backups" postgres:17-alpine pg_restore --list "/backups/$backupFileName" *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "The generated backup could not be read by pg_restore (exit code $LASTEXITCODE)."
  }
} else {
  throw 'Neither PostgreSQL client tools (pg_dump/pg_restore) nor Docker were found. Install PostgreSQL client tools or run Docker.'
}

Write-Host "Backup created and validated: $backupPath"
