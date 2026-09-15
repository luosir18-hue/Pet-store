$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$result = & node (Join-Path $PSScriptRoot 'build-mobile-test.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
$build = $result | ConvertFrom-Json
$releasePath = (Resolve-Path -LiteralPath $build.directory).Path
$distPath = (Resolve-Path -LiteralPath (Join-Path $repoPath 'dist')).Path
if (-not $releasePath.StartsWith($distPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected release path' }
$zipPath = $releasePath + '.zip'
if (Test-Path -LiteralPath $zipPath) { throw 'Archive already exists; refusing overwrite' }
Compress-Archive -LiteralPath (Join-Path $releasePath 'site'),(Join-Path $releasePath 'DEPLOYMENT.md'),(Join-Path $releasePath 'release.json') -DestinationPath $zipPath

# Verify every archived byte against the release directory, including manifest.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $fileEntries = @($archive.Entries | Where-Object { $_.Name -ne '' })
  $expected = @(Get-ChildItem -LiteralPath $releasePath -File -Recurse)
  if ($fileEntries.Count -ne $expected.Count) { throw 'ZIP file count mismatch' }
  foreach ($entry in $fileEntries) {
    $entryPath = [IO.Path]::GetFullPath((Join-Path $releasePath $entry.FullName))
    if (-not $entryPath.StartsWith($releasePath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected ZIP entry' }
    $stream = $entry.Open()
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($actual -ne (Get-FileHash -LiteralPath $entryPath -Algorithm SHA256).Hash) { throw 'ZIP hash mismatch' }
  }
} finally { $archive.Dispose() }
[pscustomobject]@{Archive=$zipPath;Version=$build.version;Files=$expected.Count;Sha256=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash;Verified=$true} | ConvertTo-Json
