"""Build and exercise the real EXE without installing packages or changing the user account."""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
POWERSHELL = shutil.which("powershell")

HARNESS = r'''
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.Windows.Forms
[Reflection.Assembly]::LoadFile($env:EXE_TEST_INSTALLER) | Out-Null
$scenario = $env:EXE_TEST_SCENARIO | ConvertFrom-Json
$result = @{}
try {
    switch ($scenario.action) {
        'extract' { [TalkingHeadSetup.Installer]::ExtractPayload($scenario.directory) }
        'validate' {
            $normalized = [TalkingHeadSetup.Installer]::NormalizeDirectory($scenario.directory)
            [TalkingHeadSetup.Installer]::ValidateDirectory($normalized)
            $result.directory = $normalized
        }
        'cleanup' { [TalkingHeadSetup.Installer]::CleanupPayload($scenario.directory) }
        'archive' {
            $source = [IO.File]::OpenRead($scenario.archive)
            try { [TalkingHeadSetup.Installer]::ExtractArchive($source, $scenario.directory) }
            finally { $source.Dispose() }
        }
        'run' {
            $lines = New-Object 'System.Collections.Concurrent.ConcurrentQueue[string]'
            $sink = [Delegate]::CreateDelegate([Action[string]], $lines, 'Enqueue')
            $result.exit_code = [TalkingHeadSetup.Installer]::RunScript(
                $scenario.script, $scenario.directory, $scenario.skip_project, $sink)
            $result.lines = $lines.ToArray()
        }
        'form' {
            [Windows.Forms.Application]::EnableVisualStyles()
            $form = New-Object TalkingHeadSetup.SetupForm
            try {
                $form.StartPosition = [Windows.Forms.FormStartPosition]::Manual
                $form.Location = New-Object Drawing.Point(-32000, -32000)
                $form.ShowInTaskbar = $false
                $form.Show()
                [Windows.Forms.Application]::DoEvents()
                $form.PerformLayout()
                $result.title = $form.Text
                $result.destination = ($form.Controls[0].Controls[2].Controls |
                    Where-Object { $_ -is [Windows.Forms.TextBox] }).Text
                $result.button_labels = @($form.Controls[0].Controls | ForEach-Object {
                    $_.Controls | Where-Object { $_ -is [Windows.Forms.Button] } | ForEach-Object { $_.Text }
                })
                $bitmap = New-Object Drawing.Bitmap($form.Width, $form.Height)
                try {
                    $form.DrawToBitmap($bitmap, (New-Object Drawing.Rectangle(0, 0, $form.Width, $form.Height)))
                    $bitmap.Save($scenario.preview, [Drawing.Imaging.ImageFormat]::Png)
                } finally { $bitmap.Dispose() }
            } finally { $form.Dispose() }
        }
        default { throw 'Unknown test action' }
    }
    $result.succeeded = $true
} catch {
    $result.succeeded = $false
    $result.message = $_.Exception.ToString()
}
Write-Output ('EXE_TEST_RESULT:' + ($result | ConvertTo-Json -Depth 8 -Compress))
'''


@unittest.skipUnless(os.name == "nt" and POWERSHELL, "requires Windows PowerShell and .NET Framework")
class WindowsExeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="installer exe ")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.base = Path(cls.temp.name)
        cls.output = cls.base / "bản build có khoảng trắng"
        build = subprocess.run(
            [POWERSHELL, "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
             "-File", str(ROOT / "build-windows-installer.ps1"), "-OutputDirectory", str(cls.output)],
            capture_output=True, encoding="utf-8", errors="replace", timeout=120)
        if build.returncode:
            raise RuntimeError(build.stdout + build.stderr)
        cls.installer = cls.output / "talking-head-short-editor-setup.exe"

    def run_action(self, action, **scenario):
        encoded = base64.b64encode(HARNESS.encode("utf-16le")).decode("ascii")
        result = subprocess.run(
            [POWERSHELL, "-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-EncodedCommand", encoded],
            env={**os.environ, "EXE_TEST_INSTALLER": str(self.installer),
                 "EXE_TEST_SCENARIO": json.dumps({"action": action, **scenario})},
            capture_output=True, encoding="utf-8", errors="replace", timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        line = next(line for line in result.stdout.splitlines() if line.startswith("EXE_TEST_RESULT:"))
        return json.loads(line.split(":", 1)[1])

    def test_artifact_is_x64_gui_executable_with_matching_checksum(self):
        binary = self.installer.read_bytes()
        self.assertEqual(binary[:2], b"MZ")
        pe = struct.unpack_from("<I", binary, 0x3C)[0]
        self.assertEqual(binary[pe:pe + 4], b"PE\0\0")
        self.assertEqual(struct.unpack_from("<H", binary, pe + 4)[0], 0x8664)
        self.assertEqual(struct.unpack_from("<H", binary, pe + 24 + 68)[0], 2)
        checksum = self.installer.with_suffix(".exe.sha256").read_text(encoding="utf-8").split()[0]
        self.assertEqual(checksum, hashlib.sha256(binary).hexdigest())
        self.assertIn(b'level="asInvoker"', binary)

    def test_embedded_payload_extracts_complete_source_without_local_data(self):
        directory = self.base / "extracted payload"
        result = self.run_action("extract", directory=str(directory))
        self.assertTrue(result["succeeded"], result)
        for relative in ("setup-windows.ps1", "SKILL.md", "README-CAI-DAT.md", "scripts/install.py",
                         "scripts/new-project.py", "assets/template/package-lock.json",
                         "assets/template/scripts/cross_platform.py",
                         "assets/template/public/fonts/be-vietnam-pro-700-vietnamese.woff2"):
            with self.subTest(file=relative):
                self.assertEqual((directory / relative).read_bytes(), (ROOT / relative).read_bytes())
        for file in directory.rglob("*"):
            self.assertFalse(any(part in {".git", "node_modules", "__pycache__", "out", "dist", ".env"}
                                 or part.startswith(".venv") for part in file.relative_to(directory).parts))

    def test_directory_validation_preserves_unrelated_data(self):
        with tempfile.TemporaryDirectory(dir=self.base) as temp:
            original = Path(temp) / "important.txt"
            original.write_text("keep me", encoding="utf-8")
            for directory in (temp, str(original)):
                result = self.run_action("validate", directory=directory)
                self.assertFalse(result["succeeded"], result)
                self.assertEqual(original.read_text(encoding="utf-8"), "keep me")

    def test_valid_destinations_and_install_recovery(self):
        with tempfile.TemporaryDirectory(dir=self.base) as temp:
            directory = Path(temp) / "ổ dữ liệu & 'quotes'" / "project"
            result = self.run_action("validate", directory=str(directory) + "\\")
            self.assertTrue(result["succeeded"], result)
            self.assertEqual(result["directory"], str(directory))
            self.assertFalse(directory.exists())
            directory.mkdir(parents=True)
            for state in ("installing", "complete", "invalid"):
                with self.subTest(state=state):
                    (directory / ".talking-head-setup").write_text(state, encoding="utf-8")
                    result = self.run_action("validate", directory=str(directory))
                    self.assertEqual(result["succeeded"], state != "invalid", result)

    def test_powershell_runner_preserves_arguments_outputs_and_failure_status(self):
        with tempfile.TemporaryDirectory(prefix="script 'quotes' ", dir=self.base) as temp:
            directory = Path(temp) / "Dữ liệu & 'quotes' $(literal)"
            script = Path(temp) / "setup stub.ps1"
            script.write_text(
                "param([switch]$NonInteractive, [string]$ProjectDirectory, [switch]$SkipProject)\n"
                "[Console]::WriteLine('PROJECT:' + $ProjectDirectory)\n"
                "[Console]::WriteLine('SKIP:' + $SkipProject.IsPresent)\n"
                "[Console]::Error.WriteLine('stderr is captured')\nexit 23\n", encoding="utf-8")
            result = self.run_action("run", script=str(script), directory=str(directory), skip_project=True)
            self.assertTrue(result["succeeded"], result)
            self.assertEqual(result["exit_code"], 23)
            self.assertIn("PROJECT:" + str(directory), result["lines"])
            self.assertIn("SKIP:True", result["lines"])
            self.assertIn("stderr is captured", result["lines"])
            self.assertFalse(directory.exists())
            script.write_text("param([switch]$NonInteractive, [string]$ProjectDirectory)\nexit 0\n", encoding="utf-8")
            result = self.run_action("run", script=str(script), directory=str(directory), skip_project=False)
            self.assertEqual(result["exit_code"], 0, result)

    def test_archive_cannot_write_outside_extraction_directory(self):
        import zipfile
        with tempfile.TemporaryDirectory(dir=self.base) as temp:
            archive = Path(temp) / "bad.zip"
            with zipfile.ZipFile(archive, "w") as package:
                package.writestr("../escaped.txt", "do not extract")
            result = self.run_action("archive", archive=str(archive), directory=str(Path(temp) / "payload"))
            self.assertFalse(result["succeeded"], result)
            self.assertFalse((Path(temp) / "escaped.txt").exists())

    def test_cleanup_cannot_delete_user_directory(self):
        with tempfile.TemporaryDirectory(dir=self.base) as temp:
            original = Path(temp) / "important.txt"
            original.write_text("keep me", encoding="utf-8")
            result = self.run_action("cleanup", directory=temp)
            self.assertFalse(result["succeeded"], result)
            self.assertEqual(original.read_text(encoding="utf-8"), "keep me")

    def test_form_constructs_and_renders_without_running_installation(self):
        preview = self.base / "preview.png"
        result = self.run_action("form", preview=str(preview))
        self.assertTrue(result["succeeded"], result)
        self.assertEqual(result["title"], "Cài đặt Talking Head Short Editor")
        self.assertEqual(Path(result["destination"]), Path(os.environ["USERPROFILE"]) / "videos/talking-head-shorts")
        self.assertIn("Cài đặt", result["button_labels"])
        self.assertGreater(preview.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()
