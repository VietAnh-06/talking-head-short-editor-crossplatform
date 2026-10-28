#Requires -Version 5.1
<#
.SYNOPSIS
Set up talking-head-short-editor natively on Windows (no WSL): Git, Node.js, FFmpeg, ImageMagick and uv via winget.
.EXAMPLE
.\setup-windows.ps1
.EXAMPLE
.\setup-windows.ps1 -ProjectName my-channel
.EXAMPLE
.\setup-windows.ps1 -SkipProject
#>
[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9][a-z0-9-]{0,63}$')]
    [string]$ProjectName = 'talking-head-shorts',
    [switch]$SkipProject
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$transcribing = $false

# Command name -> winget package. Git is also what Claude Code for Windows uses as its shell (Git Bash).
$Packages = [ordered]@{
    'git'    = 'Git.Git'
    'node'   = 'OpenJS.NodeJS.LTS'
    'ffmpeg' = 'Gyan.FFmpeg'
    'magick' = 'ImageMagick.ImageMagick'
    'uv'     = 'astral-sh.uv'
}

function Update-SessionPath {
    # winget updates the registry PATH; reload it so this session sees the new tools.
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

function Test-NodeVersion {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
    $major = [int]((& node -p 'process.versions.node.split(".")[0]') -join '')
    return $major -ge 22
}

try {
    if ($env:OS -ne 'Windows_NT') { throw 'Script nay chi chay tren Windows.' }
    if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64') {
        throw 'Can Windows x64 (Intel/AMD). Whisper va DeepFilterNet chua co ban Windows ARM.'
    }
    if ([Environment]::OSVersion.Version.Build -lt 19044) {
        throw 'Can Windows 10 21H2 (build 19044) tro len, hoac Windows 11.'
    }
    foreach ($relative in @('SKILL.md', 'scripts/install.py', 'assets/template/package-lock.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $relative) -PathType Leaf)) {
            throw "Thieu $relative. Hay giai nen toan bo thu muc truoc khi chay setup."
        }
    }
    $logDirectory = Join-Path $env:LOCALAPPDATA 'talking-head-short-editor/logs'
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    $log = Join-Path $logDirectory ("setup-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Start-Transcript -Path $log | Out-Null
    $transcribing = $true
    Write-Host "Log: $log"

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'Khong tim thay winget. Cai "App Installer" tu Microsoft Store (https://aka.ms/getwinget) roi chay lai.'
    }
    foreach ($command in $Packages.Keys) {
        $present = if ($command -eq 'node') { Test-NodeVersion } else { [bool](Get-Command $command -ErrorAction SilentlyContinue) }
        if ($present) { Write-Host "Da co: $command"; continue }
        $id = $Packages[$command]
        Write-Host "`n==> Cai $id (Windows co the hien hop thoai UAC)"
        & winget install --id $id --exact --source winget --silent --accept-package-agreements --accept-source-agreements
        # -1978335189: already installed / no applicable upgrade.
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
            throw "winget cai $id bi loi (exit $LASTEXITCODE). Xem loi phia tren, kiem tra mang roi chay lai."
        }
        Update-SessionPath
    }
    Update-SessionPath
    foreach ($command in @('git', 'node', 'npm', 'npx', 'ffmpeg', 'ffprobe', 'magick', 'uv')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Da cai nhung chua thay lenh $command trong PATH. Dong cua so nay, mo lai va chay lai setup-windows.cmd."
        }
    }
    if (-not (Test-NodeVersion)) { throw 'Can Node.js 22 tro len. Go ban Node cu roi chay lai setup.' }

    # Console Windows mac dinh cp1252: script in tieng Viet can UTF-8 (ca khi Claude Code doc output qua pipe).
    [Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')
    $env:PYTHONUTF8 = '1'

    $installArgs = @('run', (Join-Path $PSScriptRoot 'scripts/install.py'), '--project-name', $ProjectName)
    if ($SkipProject) { $installArgs += '--skip-project' }
    & uv @installArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Buoc cai skill/project bi loi (exit $LASTEXITCODE). Xem loi phia tren va chay lai setup-windows.cmd voi cung tham so."
    }

    $skill = Join-Path $HOME '.claude\skills\talking-head-short-editor'
    $project = Join-Path $HOME "videos\$ProjectName"
    Write-Host ''
    Write-Host 'CAI DAT THANH CONG' -ForegroundColor Green
    Write-Host "Skill: $skill"
    if (-not $SkipProject) {
        Write-Host "Project: $project"
        Write-Host "Mo Studio: cd `"$project`"; npm run studio"
    }
    Write-Host 'Cai Claude Code cho Windows (https://claude.com/claude-code) va dang nhap; skill nam trong ~/.claude/skills nen Claude Code tu nhan.'
    Write-Host 'Mo cua so terminal moi de PATH va PYTHONUTF8 co hieu luc.'
} catch {
    Write-Host "`nCAI DAT CHUA HOAN TAT: $($_.Exception.Message)" -ForegroundColor Red
    if ($transcribing) { Write-Host "Log: $log" }
    exit 1
} finally {
    if ($transcribing) { Stop-Transcript | Out-Null }
}
