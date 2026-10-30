#Requires -Version 5.1
<#
.SYNOPSIS
Set up talking-head-short-editor natively on Windows (no WSL): Git, Node.js, FFmpeg, ImageMagick and uv via winget.
.EXAMPLE
.\setup-windows.ps1
.EXAMPLE
.\setup-windows.ps1 -ProjectName my-channel
.EXAMPLE
.\setup-windows.ps1 -ProjectDirectory 'D:\Video Projects\my-channel'
.EXAMPLE
.\setup-windows.ps1 -NonInteractive
.EXAMPLE
.\setup-windows.ps1 -SkipProject
#>
[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9][a-z0-9-]{0,63}$')]
    [string]$ProjectName = 'talking-head-shorts',
    [ValidateScript({ -not [string]::IsNullOrWhiteSpace($_) })]
    [string]$ProjectDirectory,
    [switch]$NonInteractive,
    [switch]$SkipProject
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$transcribing = $false
$script:NodeDirectory = $null

# Command name -> winget package. Git is also what Claude Code for Windows uses as its shell (Git Bash).
$Packages = [ordered]@{
    'git'    = 'Git.Git'
    'ffmpeg' = 'Gyan.FFmpeg'
    'magick' = 'ImageMagick.ImageMagick'
    'uv'     = 'astral-sh.uv'
}

function Get-ProjectDirectory {
    param([string]$Directory, [string]$Name, [switch]$SkipPrompt)
    $defaultDirectory = Join-Path $HOME "videos\$Name"
    if (-not $Directory) {
        $Directory = $defaultDirectory
        if (-not $SkipPrompt) {
            Write-Host 'Chon thu muc project (co the dung o D, E hoac o khac).'
            Write-Host 'Vi du: D:\Video Projects\kenh-cua-toi. Nhan Enter de dung mac dinh.'
            $answer = Read-Host "Thu muc project [$defaultDirectory]"
            if (-not [string]::IsNullOrWhiteSpace($answer)) {
                $Directory = $answer.Trim().Trim('"')
            }
        }
    }
    if ([string]::IsNullOrWhiteSpace($Directory)) { throw 'Duong dan project khong duoc de trong.' }
    $provider = $null
    $drive = $null
    $resolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath(
        $Directory, [ref]$provider, [ref]$drive)
    if ($provider.Name -ne 'FileSystem') { throw 'Hay chon duong dan thu muc tren o dia.' }
    # PowerShell 5.1 passes a quoted path ending in backslash incorrectly to native programs.
    if ($resolved -ne [IO.Path]::GetPathRoot($resolved)) {
        $resolved = $resolved.TrimEnd([char[]]'\/')
    }
    return $resolved
}

function Assert-ProjectDirectoryAvailable {
    param([string]$Directory)
    if (-not (Test-Path -LiteralPath $Directory)) { return }
    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
        throw "Duong dan project la mot file: $Directory. Chon thu muc khac bang -ProjectDirectory."
    }
    $marker = Join-Path $Directory '.talking-head-setup'
    if (Test-Path -LiteralPath $marker -PathType Leaf) {
        $state = [IO.File]::ReadAllText($marker).Trim()
        if ($state -notin @('installing', 'complete')) {
            throw "Trang thai cai dat khong hop le: $marker. Chon thu muc project khac."
        }
    } elseif (Get-ChildItem -LiteralPath $Directory -Force | Select-Object -First 1) {
        throw "Thu muc project da co du lieu: $Directory. Chon thu muc trong khac bang -ProjectDirectory."
    }
}

function Update-SessionPath {
    # winget updates the registry PATH; reload it so this session sees the new tools.
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    # Keep a verified Node first, plus tools added only to the calling terminal's PATH.
    $paths = (@($script:NodeDirectory, $machine, $user, $env:Path) | Where-Object { $_ }) -join ';'
    $env:Path = ($paths -split ';' | Where-Object { $_ } | Select-Object -Unique) -join ';'
}

function Get-NodeVersion {
    param([string]$NodeCommand = 'node')
    if (-not (Get-Command $NodeCommand -CommandType Application -ErrorAction SilentlyContinue)) { return $null }
    # PowerShell 5.1 strips the nested quotes from `node -p` JavaScript
    # expressions, so parse the stable `vMAJOR.MINOR.PATCH` output instead.
    try {
        $version = ((& $NodeCommand --version 2>$null) -join '').Trim()
        if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') { return $null }
        return $version
    } catch {
        return $null
    }
}

function Test-NodeVersion {
    param([string]$NodeCommand = 'node')
    $version = Get-NodeVersion -NodeCommand $NodeCommand
    return ($null -ne $version -and [int]($version.Substring(1).Split('.')[0]) -ge 22)
}

function Install-NodeJs {
    $current = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (Test-NodeVersion) {
        $script:NodeDirectory = Split-Path -Parent $current.Source
        Write-Host "Da co Node.js $(Get-NodeVersion) (>= 22), giu nguyen."
        return
    }

    $id = 'OpenJS.NodeJS.LTS'
    $packageArgs = @('--id', $id, '--exact', '--source', 'winget', '--silent', '--accept-package-agreements', '--accept-source-agreements')
    if ($current) {
        Write-Host "`n==> Cap nhat Node.js $(Get-NodeVersion) len ban LTS (can >= 22; Windows co the hien hop thoai UAC)"
        & winget upgrade @packageArgs --include-unknown | Out-Host
        $result = $LASTEXITCODE
        # An older MSI or another Node release may not be registered as the LTS package.
        # Let the LTS installer perform the upgrade without requiring a manual uninstall.
        if ($result -eq -1978335212 -or $result -eq -1978335189) {
            Write-Host 'Chuyen sang bo cai Node.js LTS de cap nhat ban hien tai.'
            & winget install @packageArgs --force | Out-Host
            $result = $LASTEXITCODE
        }
    } else {
        Write-Host "`n==> Chua co Node.js. Cai ban LTS (can >= 22; Windows co the hien hop thoai UAC)"
        & winget install @packageArgs | Out-Host
        $result = $LASTEXITCODE
    }
    if ($result -ne 0 -and $result -ne -1978335189) {
        throw "Khong the cai/cap nhat Node.js (winget exit $result). Xem loi phia tren va log, kiem tra mang/quyen cai dat roi chay lai setup."
    }

    Update-SessionPath
    # A portable Node or version manager can leave the old executable earlier in PATH.
    # Prefer a verified new executable for this setup and every subsequent PATH refresh.
    foreach ($candidate in @(Get-Command node -All -CommandType Application -ErrorAction SilentlyContinue)) {
        if (Test-NodeVersion -NodeCommand $candidate.Source) {
            $script:NodeDirectory = Split-Path -Parent $candidate.Source
            Update-SessionPath
            break
        }
    }
    if (-not (Test-NodeVersion)) {
        $version = Get-NodeVersion
        $detected = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        $detectedPath = if ($detected) { $detected.Source } else { 'khong tim thay node' }
        throw "Da thu cai/cap nhat nhung chua chay duoc Node.js >= 22 (hien tai: '$version', duong dan: '$detectedPath'). Xem log va kiem tra cau hinh PATH/trinh quan ly phien ban Node.js."
    }
    Write-Host "Node.js san sang: $(Get-NodeVersion)"
}
Set-Alias Ensure-NodeJs Install-NodeJs

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
    $project = Get-ProjectDirectory -Directory $ProjectDirectory -Name $ProjectName -SkipPrompt:($NonInteractive -or $SkipProject)
    if (-not $SkipProject) { Assert-ProjectDirectoryAvailable -Directory $project }
    $logDirectory = Join-Path $env:LOCALAPPDATA 'talking-head-short-editor/logs'
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    $log = Join-Path $logDirectory ("setup-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Start-Transcript -Path $log | Out-Null
    $transcribing = $true
    Write-Host "Log: $log"
    Write-Host "Thu muc project: $project"

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw 'Khong tim thay winget. Cai "App Installer" tu Microsoft Store (https://aka.ms/getwinget) roi chay lai.'
    }
    Install-NodeJs
    foreach ($command in $Packages.Keys) {
        $present = [bool](Get-Command $command -ErrorAction SilentlyContinue)
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
    if (-not (Test-NodeVersion)) { throw 'Node.js trong PATH da thay doi. Can Node.js 22 tro len; xem log de kiem tra.' }

    # Console Windows mac dinh cp1252: script in tieng Viet can UTF-8 (ca khi Claude Code doc output qua pipe).
    [Environment]::SetEnvironmentVariable('PYTHONUTF8', '1', 'User')
    $env:PYTHONUTF8 = '1'

    $installArgs = @('run', (Join-Path $PSScriptRoot 'scripts/install.py'), '--project-name', $ProjectName, '--project-dir', $project)
    if ($SkipProject) { $installArgs += '--skip-project' }
    & uv @installArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Buoc cai skill/project bi loi (exit $LASTEXITCODE). Xem loi phia tren va chay lai setup-windows.cmd voi cung tham so."
    }

    $skill = Join-Path $HOME '.claude\skills\talking-head-short-editor'
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
