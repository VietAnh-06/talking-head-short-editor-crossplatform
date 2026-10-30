"""Exercise real version detection and mocked package managers; never install tools.

Run: python -m unittest discover -s tests -p test_node_setup.py -v
"""
import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
POWERSHELL = shutil.which("powershell") or shutil.which("pwsh")
GIT_BASH = Path(r"C:\Program Files\Git\bin\bash.exe")
BASH = str(GIT_BASH) if os.name == "nt" and GIT_BASH.is_file() else shutil.which("bash")


WINDOWS_HARNESS = r'''
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $env:NODE_TEST_ROOT 'setup-windows.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$ast.FindAll({ param($a) $a -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $false) |
    ForEach-Object { . ([scriptblock]::Create($_.Extent.Text)) }
$realPathRefresh = ${function:Update-SessionPath}

$scenario = $env:NODE_TEST_SCENARIO | ConvertFrom-Json
$script:Calls = New-Object 'System.Collections.Generic.List[object]'
$script:NodeDirectory = $null
function Update-SessionPath {
    $env:Path = (@($script:NodeDirectory, $env:NODE_TEST_ACTIVE_BIN, $env:NODE_TEST_INSTALLED_BIN) |
        Where-Object { $_ } | Select-Object -Unique) -join ';'
}
function winget {
    $script:Calls.Add(@($args))
    $code = if ($args[0] -eq 'upgrade') { $scenario.upgrade_code } else { $scenario.install_code }
    if ($code -eq 0 -and $scenario.new_version) {
        Copy-Item -LiteralPath $env:NODE_TEST_PENDING -Destination (Join-Path $env:NODE_TEST_INSTALLED_BIN 'node.cmd')
    }
    $global:LASTEXITCODE = $code
}
$env:Path = $env:NODE_TEST_ACTIVE_BIN
$succeeded = $false
$message = ''
$retainedSessionPath = $false
try {
    Install-NodeJs
    $env:Path += ';' + $env:NODE_TEST_SESSION_ONLY
    & $realPathRefresh
    $retainedSessionPath = ($env:Path -split ';') -contains $env:NODE_TEST_SESSION_ONLY
    Install-NodeJs
    $succeeded = $true
} catch { $message = $_.Exception.Message }
Write-Output ('NODE_TEST_RESULT:' + (@{
    succeeded = $succeeded; message = $message; version = (Get-NodeVersion)
    compatible = (Test-NodeVersion); calls = @($script:Calls.ToArray()); directory = $script:NodeDirectory
    retained_session_path = $retainedSessionPath
} | ConvertTo-Json -Depth 6 -Compress))
'''


@unittest.skipUnless(POWERSHELL and os.name == "nt", "requires Windows PowerShell")
class WindowsNodeSetupTests(unittest.TestCase):
    def run_setup(self, initial=None, new="v24.1.0", upgrade_code=0, install_code=0, node_code=0):
        with tempfile.TemporaryDirectory(prefix="node setup ") as temp:
            base = Path(temp)
            active, installed = base / "old node", base / "new node"
            active.mkdir()
            installed.mkdir()
            if initial is not None:
                (active / "node.cmd").write_text(
                    f"@echo off\necho {initial}\nexit /b {node_code}\n", encoding="ascii")
            pending = base / "pending.cmd"
            pending.write_text(f"@echo off\necho {new}\nexit /b 0\n", encoding="ascii")
            scenario = dict(new_version=new, upgrade_code=upgrade_code, install_code=install_code)
            env = {**os.environ, "NODE_TEST_ROOT": str(ROOT), "NODE_TEST_ACTIVE_BIN": str(active),
                   "NODE_TEST_INSTALLED_BIN": str(installed), "NODE_TEST_PENDING": str(pending),
                   "NODE_TEST_SESSION_ONLY": str(base / "session tools"),
                   "NODE_TEST_SCENARIO": json.dumps(scenario)}
            encoded = base64.b64encode(WINDOWS_HARNESS.encode("utf-16le")).decode("ascii")
            result = subprocess.run(
                [POWERSHELL, "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
                env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=30)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            line = next(line for line in result.stdout.splitlines() if line.startswith("NODE_TEST_RESULT:"))
            return json.loads(line.split(":", 1)[1])

    def test_compatible_versions_are_kept(self):
        for version in ("v22.0.0", "v22.21.1", "v24.1.0", "v26.0.0"):
            with self.subTest(version=version):
                result = self.run_setup(initial=version)
                self.assertTrue(result["succeeded"], result)
                self.assertEqual(result["version"], version)
                self.assertEqual(result["calls"], [])
                self.assertTrue(result["retained_session_path"])

    def test_missing_node_is_installed(self):
        result = self.run_setup()
        self.assertTrue(result["succeeded"], result)
        self.assertEqual(result["version"], "v24.1.0")
        self.assertEqual([call[0] for call in result["calls"]], ["install"])
        self.assertNotIn("--force", result["calls"][0])

    def test_old_node_is_upgraded_and_new_path_is_selected(self):
        for version in ("v18.20.8", "v20.19.0", "v21.7.3"):
            with self.subTest(version=version):
                result = self.run_setup(initial=version)
                self.assertTrue(result["succeeded"], result)
                self.assertEqual(result["version"], "v24.1.0")
                self.assertEqual([call[0] for call in result["calls"]], ["upgrade"])
                self.assertIn("--include-unknown", result["calls"][0])
                self.assertIn("new node", result["directory"])
                self.assertTrue(result["retained_session_path"])

    def test_unrecognized_install_falls_back_to_lts_installer(self):
        for code in (-1978335212, -1978335189):
            with self.subTest(code=code):
                result = self.run_setup(initial="v20.19.0", upgrade_code=code)
                self.assertTrue(result["succeeded"], result)
                self.assertEqual([call[0] for call in result["calls"]], ["upgrade", "install"])
                self.assertIn("--force", result["calls"][1])

    def test_invalid_or_broken_node_is_repaired(self):
        for version, code in (("not-a-version", 0), ("v22.1.0", 1)):
            with self.subTest(version=version, code=code):
                result = self.run_setup(initial=version, node_code=code)
                self.assertTrue(result["succeeded"], result)
                self.assertEqual(result["version"], "v24.1.0")
                self.assertEqual(result["calls"][0][0], "upgrade")

    def test_upgrade_error_stops_without_installing(self):
        result = self.run_setup(initial="v20.1.0", upgrade_code=23)
        self.assertFalse(result["succeeded"])
        self.assertIn("23", result["message"])
        self.assertEqual([call[0] for call in result["calls"]], ["upgrade"])

    def test_install_error_stops_setup(self):
        result = self.run_setup(install_code=24)
        self.assertFalse(result["succeeded"])
        self.assertIn("24", result["message"])

    def test_success_exit_does_not_hide_incompatible_version(self):
        for new in ("v20.19.0", None):
            with self.subTest(new=new):
                result = self.run_setup(initial="v18.1.0", new=new)
                self.assertFalse(result["succeeded"])
                self.assertIn(">= 22", result["message"])

    def test_missing_node_after_install_has_actionable_error(self):
        result = self.run_setup(new=None)
        self.assertFalse(result["succeeded"])
        self.assertIn("khong tim thay node", result["message"])


@unittest.skipUnless(BASH, "requires Bash")
class MacOSNodeSetupTests(unittest.TestCase):
    def run_setup(self, initial=None, new="v24.1.0", managed=False, package_code=0):
        source = (ROOT / "setup-macos.sh").read_text(encoding="utf-8")
        functions = source.split("node_version() {", 1)[1].split("# Preserve an already compatible Node", 1)[0]
        with tempfile.TemporaryDirectory(prefix="node setup ") as temp:
            base = Path(temp)
            active, installed = base / "old node", base / "brew node/bin"
            active.mkdir()
            installed.mkdir(parents=True)
            if initial is not None:
                (active / "node").write_text(f"#!/bin/sh\nprintf '%s\\n' '{initial}'\n", encoding="ascii")
                (active / "node").chmod(0o755)
            pending = base / "pending"
            pending.write_text(f"#!/bin/sh\nprintf '%s\\n' '{new}'\n", encoding="ascii")
            pending.chmod(0o755)
            log = base / "calls.txt"
            env = {**os.environ, "NODE_TEST_ACTIVE_BIN": str(active), "NODE_TEST_PREFIX": str(installed.parent),
                   "NODE_TEST_PENDING": str(pending), "NODE_TEST_LOG": str(log),
                   "NODE_TEST_MANAGED": "0" if managed else "1", "NODE_TEST_PACKAGE_CODE": str(package_code),
                   "NODE_TEST_NEW": new or ""}
            harness = r'''
set -euo pipefail
if command -v cygpath >/dev/null; then
  NODE_TEST_ACTIVE_BIN=$(cygpath -u "$NODE_TEST_ACTIVE_BIN")
  NODE_TEST_PREFIX=$(cygpath -u "$NODE_TEST_PREFIX")
  NODE_TEST_PENDING=$(cygpath -u "$NODE_TEST_PENDING")
  NODE_TEST_LOG=$(cygpath -u "$NODE_TEST_LOG")
fi
export PATH="$NODE_TEST_ACTIVE_BIN"
fail() { printf '%s\n' "$*" >&2; exit 1; }
brew() {
  printf '%s\n' "$*" >> "$NODE_TEST_LOG"
  case "$1" in
    list) return "$NODE_TEST_MANAGED" ;;
    install|upgrade)
      if (( NODE_TEST_PACKAGE_CODE != 0 )); then return "$NODE_TEST_PACKAGE_CODE"; fi
      if [[ -n $NODE_TEST_NEW ]]; then
        /bin/cp "$NODE_TEST_PENDING" "$NODE_TEST_PREFIX/bin/node"
        /bin/chmod +x "$NODE_TEST_PREFIX/bin/node"
      fi ;;
    --prefix) printf '%s\n' "$NODE_TEST_PREFIX" ;;
    *) return 98 ;;
  esac
}
'''
            harness += "\nnode_version() {" + functions + '\nensure_node\nnode_version\n'
            result = subprocess.run([BASH, "--noprofile", "--norc", "-c", harness], env=env,
                                    capture_output=True, encoding="utf-8", errors="replace", timeout=30)
            calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
            return result, calls

    def test_compatible_versions_are_kept(self):
        for version in ("v22.0.0", "v24.1.0", "v26.0.0"):
            with self.subTest(version=version):
                result, calls = self.run_setup(initial=version)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(calls, [])
                self.assertIn(version, result.stdout)

    def test_missing_node_is_installed(self):
        result, calls = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("install node", calls)
        self.assertIn("v24.1.0", result.stdout)

    def test_homebrew_node_is_upgraded(self):
        result, calls = self.run_setup(initial="v20.19.0", managed=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("upgrade node", calls)
        self.assertTrue(result.stdout.rstrip().endswith("v24.1.0"))

    def test_node_from_other_installer_is_replaced_in_session_path(self):
        result, calls = self.run_setup(initial="v18.1.0")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("install node", calls)
        self.assertTrue(result.stdout.rstrip().endswith("v24.1.0"))

    def test_invalid_version_is_repaired(self):
        result, calls = self.run_setup(initial="not-a-version")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("install node", calls)

    def test_package_error_stops_setup(self):
        result, calls = self.run_setup(initial="v20.1.0", managed=True, package_code=23)
        self.assertEqual(result.returncode, 23, result.stderr)
        self.assertEqual(calls, ["list --versions node", "upgrade node"])

    def test_incompatible_version_after_upgrade_stops_setup(self):
        for new in ("v20.1.0", None):
            with self.subTest(new=new):
                result, _ = self.run_setup(initial="v18.1.0", managed=True, new=new)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(">= 22", result.stderr)


if __name__ == "__main__":
    unittest.main()
