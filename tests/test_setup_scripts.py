"""Test installer recovery/data protection without downloads or system changes.

Run: uv run python -m unittest discover -s tests -v
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ProjectSetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="talking-head-setup-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.skill = self.base / "skill có khoảng trắng"
        (self.skill / "scripts").mkdir(parents=True)
        shutil.copy2(ROOT / "scripts/new-project.py", self.skill / "scripts/new-project.py")
        template = self.skill / "assets/template"
        (template / "scripts").mkdir(parents=True)
        shutil.copy2(ROOT / "assets/template/scripts/cross_platform.py", template / "scripts/cross_platform.py")
        (template / "src/talking").mkdir(parents=True)
        (template / "package-lock.json").write_text('{}')
        (template / "src/talking/sfx-library.json").write_text('{"pop": 1}')
        (template / "user-edit.txt").write_text("original")
        (template / "scripts/fetch-mixkit-sfx.py").write_text('''import os, pathlib
pathlib.Path("public/sfx").mkdir(parents=True, exist_ok=True)
if os.environ.get("MISSING_SFX") != "1":
    pathlib.Path("public/sfx/pop.mp3").write_text("sound")
''')
        mocks = self.base / "bin"
        mocks.mkdir()
        dispatcher = mocks / "dispatch"
        dispatcher.write_text('''#!/usr/bin/env python3
import json, os, pathlib, sys
tool = pathlib.Path(sys.argv[0]).name
with open(os.environ['SETUP_TEST_LOG'], 'a') as log:
    log.write(json.dumps([tool, *sys.argv[1:]]) + '\\n')
if tool == 'npm' and os.environ.get('FAIL_NPM') == '1': sys.exit(23)
if tool == 'npx' and os.environ.get('FAIL_TYPECHECK') == '1': sys.exit(24)
if tool == 'uv' and sys.argv[1] == 'venv':
    python = pathlib.Path(sys.argv[-1]) / 'bin/python'
    python.parent.mkdir(parents=True)
    python.write_text('#!/bin/sh\\nexit 0\\n')
    python.chmod(0o755)
''')
        dispatcher.chmod(0o755)
        for name in ("npm", "npx", "uv", "ffmpeg", "ffprobe"):
            (mocks / name).symlink_to(dispatcher)
        self.log = self.base / "commands.jsonl"
        self.env = {**os.environ, "PATH": f"{mocks}:{os.environ['PATH']}", "SETUP_TEST_LOG": str(self.log)}
        self.project = self.base / "project tiếng Việt & 'quotes'"

    def run_setup(self, *args, **env):
        return subprocess.run(
            [sys.executable, str(self.skill / "scripts/new-project.py"), str(self.project), *args],
            env={**self.env, **env}, capture_output=True, text=True,
        )

    def state(self):
        return (self.project / ".talking-head-setup").read_text().strip()

    def test_new_project_installs_from_lockfile(self):
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state(), "complete")
        commands = [json.loads(line) for line in self.log.read_text().splitlines()]
        self.assertIn(["npm", "ci", "--no-audit", "--no-fund"], commands)

    def test_failed_install_resumes_without_overwriting_edits(self):
        result = self.run_setup("--resume", FAIL_NPM="1")
        self.assertEqual(result.returncode, 23)
        self.assertEqual(self.state(), "installing")
        edited = self.project / "user-edit.txt"
        edited.write_text("keep my edits")
        result = self.run_setup("--resume")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(edited.read_text(), "keep my edits")
        self.assertEqual(self.state(), "complete")

    def test_refuses_unrelated_directory_even_with_resume(self):
        self.project.mkdir()
        original = self.project / "important.txt"
        original.write_text("keep me")
        for args in ((), ("--resume",)):
            self.assertNotEqual(self.run_setup(*args).returncode, 0)
            self.assertEqual(original.read_text(), "keep me")
        self.assertFalse(self.log.exists())

    def test_refuses_file_destination(self):
        self.project.write_text("keep me")
        self.assertNotEqual(self.run_setup("--resume").returncode, 0)
        self.assertEqual(self.project.read_text(), "keep me")

    def test_refuses_completed_project(self):
        self.assertEqual(self.run_setup().returncode, 0)
        for args in ((), ("--resume",)):
            self.assertNotEqual(self.run_setup(*args).returncode, 0)
            self.assertEqual(self.state(), "complete")

    def test_missing_sfx_cannot_report_success(self):
        result = self.run_setup(MISSING_SFX="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Thiếu SFX pop", result.stderr)
        self.assertEqual(self.state(), "installing")
        self.assertEqual(self.run_setup("--resume").returncode, 0)

    def test_invalid_sfx_manifest_fails_setup(self):
        (self.skill / "assets/template/src/talking/sfx-library.json").write_text("{broken")
        result = self.run_setup()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("sfx-library.json", result.stderr)
        self.assertEqual(self.state(), "installing")

    def test_typecheck_failure_remains_resumable(self):
        self.assertEqual(self.run_setup(FAIL_TYPECHECK="1").returncode, 24)
        self.assertEqual(self.state(), "installing")
        self.assertEqual(self.run_setup("--resume").returncode, 0)

    def test_unknown_option_leaves_destination_untouched(self):
        self.assertNotEqual(self.run_setup("--wrong").returncode, 0)
        self.assertFalse(self.project.exists())


if __name__ == "__main__":
    unittest.main()
