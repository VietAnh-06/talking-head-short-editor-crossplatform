#Requires -Version 5.1
<#
.SYNOPSIS
Build a single Windows setup EXE using the .NET Framework compiler included in Windows.
.EXAMPLE
.\build-windows-installer.ps1
.EXAMPLE
.\build-windows-installer.ps1 -OutputDirectory 'D:\Releases'
#>
[CmdletBinding()]
param([ValidateNotNullOrEmpty()][string]$OutputDirectory)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Build this installer on Windows.' }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler -PathType Leaf)) { throw "Missing .NET Framework compiler: $compiler" }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not $PSBoundParameters.ContainsKey('OutputDirectory')) { $OutputDirectory = Join-Path $PSScriptRoot 'dist' }
$output = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
[IO.Directory]::CreateDirectory($output) | Out-Null
$buildRoot = Join-Path $PSScriptRoot 'build'
$stage = Join-Path $buildRoot ('installer-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($stage) | Out-Null
try {
    $payload = Join-Path $stage 'payload.zip'
    $archive = [IO.Compression.ZipFile]::Open($payload, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $included = New-Object 'System.Collections.Generic.HashSet[string]'
        foreach ($item in @('setup-windows.ps1', 'SKILL.md', 'README-CAI-DAT.md', 'scripts', 'assets', 'references')) {
            $source = Join-Path $PSScriptRoot $item
            if (-not (Test-Path -LiteralPath $source)) { throw "Missing installer input: $item" }
            foreach ($file in @(Get-ChildItem -LiteralPath $source -File -Recurse)) {
                $relative = $file.FullName.Substring($PSScriptRoot.Length + 1).Replace('\', '/')
                if ($relative -match '(^|/)(node_modules|\.venv[^/]*|__pycache__|\.bin|out|\.git)(/|$)') { continue }
                if ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Cannot package a link: $relative" }
                # Ship only source, documentation and bundled fonts, never local configs or credentials.
                if ($file.Extension -notin @('.ps1', '.md', '.py', '.ts', '.tsx', '.mjs', '.json', '.otf', '.woff2')) { continue }
                [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative,
                    [IO.Compression.CompressionLevel]::Optimal) | Out-Null
                $included.Add($relative) | Out-Null
            }
        }
        foreach ($required in @('setup-windows.ps1', 'SKILL.md', 'README-CAI-DAT.md', 'scripts/install.py',
            'scripts/new-project.py', 'assets/template/package.json', 'assets/template/package-lock.json',
            'assets/template/scripts/cross_platform.py')) {
            if (-not $included.Contains($required)) { throw "Installer payload is missing $required" }
        }
    } finally { $archive.Dispose() }

    $compiled = Join-Path $stage 'talking-head-short-editor-setup.exe'
    $arguments = @('/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/utf8output', '/codepage:65001',
        "/out:$compiled", "/win32manifest:$(Join-Path $PSScriptRoot 'installer/windows/app.manifest')",
        "/resource:$payload,payload.zip", '/reference:System.dll', '/reference:System.Core.dll',
        '/reference:System.Drawing.dll', '/reference:System.Windows.Forms.dll',
        '/reference:System.IO.Compression.dll', '/reference:System.IO.Compression.FileSystem.dll',
        (Join-Path $PSScriptRoot 'installer/windows/Setup.cs'))
    & $compiler @arguments
    if ($LASTEXITCODE -ne 0) { throw "Installer compilation failed (exit $LASTEXITCODE)." }
    $installer = Join-Path $output 'talking-head-short-editor-setup.exe'
    Copy-Item -LiteralPath $compiled -Destination $installer -Force
    $hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$installer.sha256", "$hash  $([IO.Path]::GetFileName($installer))" + [Environment]::NewLine,
        (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Built: $installer"
    Write-Host "SHA-256: $hash"
} finally {
    # Only remove the unique build staging directory, never the project or caller's output directory.
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if ([IO.Path]::GetDirectoryName($resolvedStage) -ne [IO.Path]::GetFullPath($buildRoot) -or
        [IO.Path]::GetFileName($resolvedStage) -notmatch '^installer-[a-f0-9]{32}$') {
        throw "Refusing to remove unexpected staging directory: $resolvedStage"
    }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
