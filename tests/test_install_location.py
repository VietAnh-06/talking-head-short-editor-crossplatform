"""Exercise installer destinations with temporary files and mocked tools only."""
import base64
import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
POWERSHELL = shutil.which("powershell") or shutil.which("pwsh")


class InstallerLocationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="install location ")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.home = self.base / "user"
        self.home.mkdir()
        self.source = self.base / "source"
        for directory in ("scripts", "assets/template/scripts", "references"):
            (self.source / directory).mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / "scripts/install.py", self.source / "scripts/install.py")
        for filename in ("SKILL.md", "README-CAI-DAT.md"):
            (self.source / filename).write_text("fixture", encoding="utf-8")
        self.skill = self.home / ".claude/skills/talking-head-short-editor"
        self.project = self.base / "ổ dữ liệu" / "Video & 'quotes'" / "kênh của tôi"
        self.calls = []

        def run(command):
            command = list(map(str, command))
            self.calls.append((Path.cwd(), command))
            if len(command) > 2 and command[2].endswith("new-project.py"):
                project = Path(command[3])
                project.mkdir(parents=True, exist_ok=True)
                (project / ".talking-head-setup").write_text("complete\n", encoding="utf-8")

        def die(message):
            print(message, file=sys.stderr)
            raise SystemExit(1)

        self.platform = types.ModuleType("cross_platform")
        self.platform.run = run
        self.platform.die = die
        self.platform.venv_cmd = lambda venv, *args: [venv, *args]

    def run_installer(self, *args):
        output, errors = io.StringIO(), io.StringIO()
        original_directory = Path.cwd()
        try:
            os.chdir(self.base)
            with (patch.object(sys, "argv", ["install.py", *map(str, args)]),
                  patch.object(sys, "path", sys.path.copy()),
                  patch.object(Path, "home", return_value=self.home),
                  patch.dict(sys.modules, {"cross_platform": self.platform}),
                  contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors)):
                try:
                    runpy.run_path(str(self.source / "scripts/install.py"), run_name="__main__")
                except SystemExit as error:
                    return error.code, output.getvalue(), errors.getvalue()
            return 0, output.getvalue(), errors.getvalue()
        finally:
            os.chdir(original_directory)

    def project_commands(self):
        return [command for _, command in self.calls
                if len(command) > 2 and command[2].endswith("new-project.py")]

    def test_custom_destination_takes_precedence_and_checks_run_there(self):
        code, output, errors = self.run_installer(
            "--project-name", "other-name", "--project-dir", self.project)
        self.assertEqual(code, 0, errors)
        self.assertEqual(self.project_commands(), [
            ["uv", "run", str(self.skill / "scripts/new-project.py"), str(self.project), "--resume"]])
        self.assertIn(str(self.project), output)
        self.assertTrue(self.skill.is_dir())
        self.assertFalse((self.home / "videos").exists())
        self.assertTrue(all(cwd == self.project for cwd, _ in self.calls[2:]))

    def test_default_destination_still_uses_project_name(self):
        code, _, errors = self.run_installer("--project-name", "my-channel")
        self.assertEqual(code, 0, errors)
        self.assertEqual(self.project_commands()[0][3], str(self.home / "videos/my-channel"))

    def test_relative_destination_is_resolved_before_directory_changes(self):
        code, _, errors = self.run_installer("--project-dir", "relative project")
        self.assertEqual(code, 0, errors)
        self.assertEqual(self.project_commands()[0][3], str(self.base / "relative project"))

    def test_tilde_destination_is_expanded(self):
        with patch.dict(os.environ, {"USERPROFILE": str(self.home), "HOME": str(self.home)}):
            code, _, errors = self.run_installer("--project-dir", "~/custom project")
        self.assertEqual(code, 0, errors)
        self.assertEqual(self.project_commands()[0][3], str(self.home / "custom project"))

    def test_skip_project_keeps_custom_destination_in_instructions(self):
        code, output, errors = self.run_installer("--project-dir", self.project, "--skip-project")
        self.assertEqual(code, 0, errors)
        self.assertIn(f'"{self.project}"', output)
        self.assertFalse(self.project.exists())
        self.assertEqual(self.project_commands(), [])

    def test_existing_empty_destination_is_allowed(self):
        self.project.mkdir(parents=True)
        code, _, errors = self.run_installer("--project-dir", self.project)
        self.assertEqual(code, 0, errors)
        self.assertEqual(self.project_commands()[0][3], str(self.project))

    def test_incomplete_install_resumes_at_custom_destination(self):
        self.project.mkdir(parents=True)
        (self.project / ".talking-head-setup").write_text("installing\n", encoding="utf-8")
        edited = self.project / "user-edit.txt"
        edited.write_text("keep my edits", encoding="utf-8")
        code, _, errors = self.run_installer("--project-dir", self.project)
        self.assertEqual(code, 0, errors)
        self.assertEqual(self.project_commands()[0][-2:], [str(self.project), "--resume"])
        self.assertEqual(edited.read_text(encoding="utf-8"), "keep my edits")

    def test_completed_project_is_kept_without_recreating_it(self):
        self.project.mkdir(parents=True)
        (self.project / ".talking-head-setup").write_text("complete\n", encoding="utf-8")
        code, _, errors = self.run_installer("--project-dir", self.project)
        self.assertEqual(code, 0, errors)
        self.assertEqual(self.project_commands(), [])
        self.assertTrue(any(cwd == self.project and cmd == ["npm", "run", "typecheck"]
                            for cwd, cmd in self.calls))

    def test_unrelated_data_is_rejected_before_skill_copy_or_downloads(self):
        self.project.mkdir(parents=True)
        original = self.project / "important.txt"
        original.write_text("keep me", encoding="utf-8")
        code, _, errors = self.run_installer("--project-dir", self.project)
        self.assertNotEqual(code, 0)
        self.assertIn("--project-dir", errors)
        self.assertEqual(original.read_text(encoding="utf-8"), "keep me")
        self.assertEqual(self.calls, [])
        self.assertFalse(self.skill.exists())

    def test_file_destination_is_rejected_before_downloads(self):
        self.project.parent.mkdir(parents=True)
        self.project.write_text("keep me", encoding="utf-8")
        code, _, _ = self.run_installer("--project-dir", self.project)
        self.assertNotEqual(code, 0)
        self.assertEqual(self.project.read_text(encoding="utf-8"), "keep me")
        self.assertEqual(self.calls, [])
        self.assertFalse(self.skill.exists())

    def test_blank_destination_is_rejected(self):
        for directory in ("", "   "):
            with self.subTest(directory=directory):
                code, _, _ = self.run_installer("--project-dir", directory)
                self.assertNotEqual(code, 0)
                self.assertEqual(self.calls, [])
                self.assertFalse(self.skill.exists())

    def test_destination_cannot_overlap_skill_that_installer_replaces(self):
        for directory in (self.skill, self.skill / "project", self.skill.parent):
            with self.subTest(directory=directory):
                code, _, errors = self.run_installer("--project-dir", directory)
                self.assertNotEqual(code, 0)
                self.assertIn("--project-dir", errors)
                self.assertEqual(self.calls, [])
                self.assertFalse(self.skill.exists())

    def test_invalid_marker_is_rejected_before_downloads(self):
        self.project.mkdir(parents=True)
        (self.project / ".talking-head-setup").write_text("unknown\n", encoding="utf-8")
        code, _, _ = self.run_installer("--project-dir", self.project)
        self.assertNotEqual(code, 0)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.skill.exists())


WINDOWS_HARNESS = r'''
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $env:LOCATION_TEST_ROOT 'setup-windows.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$ast.FindAll({ param($a) $a -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $false) |
    ForEach-Object { . ([scriptblock]::Create($_.Extent.Text)) }
$script:PromptCount = 0
function Read-Host {
    $script:PromptCount += 1
    return $env:LOCATION_TEST_ANSWER
}
$succeeded = $false
$message = ''
$directory = ''
$nativeArgumentsJson = '[]'
try {
    $directory = Get-ProjectDirectory -Directory $env:LOCATION_TEST_DIRECTORY -Name 'my-channel' `
        -SkipPrompt:($env:LOCATION_TEST_SKIP_PROMPT -eq '1')
    Assert-ProjectDirectoryAvailable -Directory $directory
    $nativeArgumentsJson = & $env:LOCATION_TEST_PYTHON -c 'import json,sys;print(json.dumps(sys.argv[1:]))' $directory
    $succeeded = $true
} catch { $message = $_.Exception.Message }
Write-Output ('LOCATION_TEST_RESULT:' + (@{
    succeeded = $succeeded; message = $message; directory = $directory
    native_arguments_json = $nativeArgumentsJson
    prompt_count = $script:PromptCount
    default_directory = (Join-Path $HOME 'videos\my-channel')
} | ConvertTo-Json -Compress))
'''


@unittest.skipUnless(POWERSHELL and os.name == "nt", "requires Windows PowerShell")
class WindowsInstallLocationTests(unittest.TestCase):
    def run_setup(self, directory="", answer="", skip_prompt=False):
        env = {**os.environ, "LOCATION_TEST_ROOT": str(ROOT), "LOCATION_TEST_DIRECTORY": str(directory),
               "LOCATION_TEST_ANSWER": str(answer), "LOCATION_TEST_SKIP_PROMPT": "1" if skip_prompt else "0",
               "LOCATION_TEST_PYTHON": sys.executable}
        encoded = base64.b64encode(WINDOWS_HARNESS.encode("utf-16le")).decode("ascii")
        result = subprocess.run(
            [POWERSHELL, "-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
            env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        line = next(line for line in result.stdout.splitlines() if line.startswith("LOCATION_TEST_RESULT:"))
        payload = json.loads(line.split(":", 1)[1])
        payload["native_arguments"] = json.loads(payload.pop("native_arguments_json"))
        return payload

    def test_explicit_path_does_not_prompt(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / "ổ dữ liệu" / "Video & 'quotes'" / "kênh của tôi"
            result = self.run_setup(directory=directory)
            self.assertTrue(result["succeeded"], result)
            self.assertEqual(result["directory"], str(directory))
            self.assertEqual(result["native_arguments"], [str(directory)])
            self.assertEqual(result["prompt_count"], 0)
            self.assertFalse(directory.exists())

    def test_interactive_answer_selects_directory_and_accepts_quotes(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / "project có khoảng trắng"
            result = self.run_setup(answer=f'"{directory}"')
            self.assertTrue(result["succeeded"], result)
            self.assertEqual(result["directory"], str(directory))
            self.assertEqual(result["prompt_count"], 1)

    def test_trailing_separator_is_removed_before_passing_to_native_tools(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / "project có khoảng trắng"
            result = self.run_setup(directory=str(directory) + "\\")
            self.assertTrue(result["succeeded"], result)
            self.assertEqual(result["directory"], str(directory))
            self.assertEqual(result["native_arguments"], [str(directory)])

    def test_non_filesystem_path_is_rejected(self):
        result = self.run_setup(directory="HKCU:\\Software\\VideoProject")
        self.assertFalse(result["succeeded"], result)
        self.assertIn("o dia", result["message"])

    def test_enter_uses_default_directory(self):
        result = self.run_setup()
        self.assertTrue(result["succeeded"], result)
        self.assertEqual(result["directory"], result["default_directory"])
        self.assertEqual(result["prompt_count"], 1)

    def test_noninteractive_uses_default_without_prompting(self):
        result = self.run_setup(skip_prompt=True)
        self.assertTrue(result["succeeded"], result)
        self.assertEqual(result["directory"], result["default_directory"])
        self.assertEqual(result["prompt_count"], 0)

    def test_refuses_unrelated_directory_and_file(self):
        with tempfile.TemporaryDirectory() as temp:
            original = Path(temp) / "important.txt"
            original.write_text("keep me", encoding="utf-8")
            for directory in (temp, original):
                with self.subTest(directory=directory):
                    result = self.run_setup(directory=directory)
                    self.assertFalse(result["succeeded"], result)
                    self.assertIn("-ProjectDirectory", result["message"])
                    self.assertEqual(original.read_text(encoding="utf-8"), "keep me")

    def test_allows_resuming_and_completed_projects(self):
        with tempfile.TemporaryDirectory() as temp:
            marker = Path(temp) / ".talking-head-setup"
            for state in ("installing", "complete"):
                with self.subTest(state=state):
                    marker.write_text(state + "\n", encoding="utf-8")
                    result = self.run_setup(directory=temp)
                    self.assertTrue(result["succeeded"], result)

    def test_refuses_invalid_marker(self):
        with tempfile.TemporaryDirectory() as temp:
            for state in ("", "unknown\n"):
                with self.subTest(state=state):
                    (Path(temp) / ".talking-head-setup").write_text(state, encoding="utf-8")
                    result = self.run_setup(directory=temp)
                    self.assertFalse(result["succeeded"], result)
                    self.assertIn("Trang thai", result["message"])


if __name__ == "__main__":
    unittest.main()
