"""Regression checks for shared-code sync, delivery and final QA, without models or media downloads."""
import contextlib
import importlib.util
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
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "assets/template/scripts"


def load_script(filename):
    spec = importlib.util.spec_from_file_location(filename.replace("-", "_"), SCRIPTS / filename)
    module = importlib.util.module_from_spec(spec)
    with patch.object(sys, "path", [str(SCRIPTS), *sys.path]):
        spec.loader.exec_module(module)
    return module


class IsolatedFiles(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="editing QA có dấu ")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def write(self, path, content="fixture"):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def execute(self, script, *args):
        return subprocess.run([sys.executable, "-X", "utf8", str(script), *map(str, args)],
                              capture_output=True, encoding="utf-8", timeout=20)


class SyncSafetyTests(IsolatedFiles):
    def setUp(self):
        super().setUp()
        self.skill = self.base / "skill"
        self.template = self.skill / "assets/template"
        self.project = self.base / "project"
        self.project.mkdir()
        self.script = self.skill / "scripts/sync-template.py"
        self.write(self.script, (ROOT / "scripts/sync-template.py").read_text(encoding="utf-8"))
        self.write(self.template / "scripts/cross_platform.py", (SCRIPTS / "cross_platform.py").read_text(encoding="utf-8"))
        self.write(self.template / "src/talking/motion.tsx", "old")
        self.write(self.project / "src/talking/motion.tsx", "fixed")
        self.write(self.project / "scripts/edits/private.json", "private data")
        self.write(self.project / "src/talking/edits/private.json", "private data")

    def test_shared_fix_can_be_pulled(self):
        result = self.execute(self.script, self.project, "--pull", "src/talking/motion.tsx")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.template / "src/talking/motion.tsx").read_text(), "fixed")

    def test_invalid_batch_does_not_partially_overwrite(self):
        for invalid in ("../outside.txt", str(self.base / "outside.txt"), "src/videos/private.tsx",
                        "scripts/edits/private.json", "scripts//edits/private.json", "scripts/EDITS/private.json", "src/talking/edits/private.json",
                        "C:/outside.txt", "src/talking/../../private.txt"):
            with self.subTest(invalid=invalid):
                result = self.execute(self.script, self.project, "--pull", "src/talking/motion.tsx", invalid)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual((self.template / "src/talking/motion.tsx").read_text(), "old")

    def test_package_sync_includes_lockfile(self):
        self.write(self.project / "package.json", '{"dependencies": {"a": "2"}}')
        self.write(self.project / "package-lock.json", '{"lockfileVersion": 3}')
        result = self.execute(self.script, self.project, "--pull", "package.json")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.template / "package-lock.json").read_text(), '{"lockfileVersion": 3}')

    def test_missing_source_leaves_other_files_untouched(self):
        result = self.execute(self.script, self.project, "--pull", "src/talking/motion.tsx", "src/theme.ts")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.template / "src/talking/motion.tsx").read_text(), "old")

    def test_linked_source_is_refused(self):
        link = self.project / "src/talking/link.tsx"
        outside = self.write(self.base / "outside.tsx", "private")
        try:
            link.symlink_to(outside)
        except OSError as error:
            self.skipTest(f"symlink not available: {error}")
        result = self.execute(self.script, self.project, "--pull", "src/talking/link.tsx")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.template / "src/talking/link.tsx").exists())

    def test_junction_source_is_refused_on_windows_without_symlink_privilege(self):
        if os.name != "nt":
            self.skipTest("Windows junction check")
        outside = self.base / "private"
        self.write(outside / "secret.tsx", "private data")
        link = self.project / "src/talking/linked"
        result = subprocess.run(["powershell", "-NoProfile", "-Command",
                                 "New-Item -ItemType Junction -Path $env:QA_LINK -Target $env:QA_TARGET | Out-Null"],
                                env={**os.environ, "QA_LINK": str(link), "QA_TARGET": str(outside)}, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.addCleanup(link.rmdir)
        result = self.execute(self.script, self.project, "--pull", "src/talking/linked/secret.tsx")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.template / "src/talking/linked").exists())


class DeliverySafetyTests(IsolatedFiles):
    def setUp(self):
        super().setUp()
        self.project = self.base / "project"
        self.script = self.project / "scripts/deliver.py"
        self.write(self.script, (SCRIPTS / "deliver.py").read_text(encoding="utf-8"))
        self.write(self.project / "scripts/cross_platform.py", (SCRIPTS / "cross_platform.py").read_text(encoding="utf-8"))
        self.final = self.write(self.project / "out/final/lesson.mp4", "new video")
        self.raw = self.write(self.project / "out/lesson.mp4", "raw video")
        self.output = self.project / "du-lieu/video-xuat"

    def test_video_cover_and_caption_are_delivered_together(self):
        self.write(self.project / "out/final/lesson-cover.jpg", "cover")
        self.write(self.project / "out/final/lesson-caption.txt", "caption")
        result = self.execute(self.script, "lesson", "video-007-lesson")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.output / "video-007-lesson.mp4").read_text(), "new video")
        self.assertEqual((self.output / "video-007-lesson-cover.jpg").read_text(), "cover")
        self.assertEqual((self.output / "video-007-lesson.txt").read_text(), "caption")
        self.assertFalse(self.final.exists())
        self.assertFalse(self.raw.exists())

    def test_unsafe_name_is_refused_before_moving_video(self):
        for name in ("../escape", str(self.base / "escape"), "nested/name", "C:/escape", "lesson.mp4"):
            with self.subTest(name=name):
                result = self.execute(self.script, "lesson", name)
                self.assertNotEqual(result.returncode, 0)
                self.assertTrue(self.final.exists())
                self.assertTrue(self.raw.exists())
                self.assertFalse(self.output.exists())

    def test_new_delivery_replaces_existing_name(self):
        self.write(self.output / "video-007-lesson.mp4", "old video")
        result = self.execute(self.script, "lesson")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.output / "video-007-lesson.mp4").read_text(), "new video")
        self.assertEqual(len(list(self.output.glob("*.mp4"))), 1)

    def test_renaming_existing_delivery_is_refused(self):
        self.write(self.output / "video-007-lesson.mp4", "old video")
        result = self.execute(self.script, "lesson", "video-008-lesson")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.output / "video-007-lesson.mp4").read_text(), "old video")
        self.assertTrue(self.final.exists())

    def test_adding_caption_keeps_new_unmastered_render(self):
        self.final.unlink()
        self.write(self.output / "video-007-lesson.mp4", "delivered video")
        self.write(self.project / "out/final/lesson-caption.txt", "caption")
        result = self.execute(self.script, "lesson")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.raw.read_text(), "raw video")

    def test_empty_master_cannot_replace_good_delivery(self):
        self.final.write_text("")
        self.write(self.output / "lesson.mp4", "good video")
        result = self.execute(self.script, "lesson")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.output / "lesson.mp4").read_text(), "good video")
        self.assertTrue(self.raw.exists())

    def test_custom_delivery_name_is_preserved_and_can_be_inferred(self):
        result = self.execute(self.script, "lesson", "Bài học của tôi")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.write(self.final, "updated video")
        result = self.execute(self.script, "lesson")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.output / "Bài học của tôi.mp4").read_text(), "updated video")
        self.assertEqual(len(list(self.output.glob("*.mp4"))), 1)

    def test_custom_name_cannot_be_changed_or_claimed_by_another_video(self):
        self.assertEqual(self.execute(self.script, "lesson", "custom-title").returncode, 0)
        self.write(self.final, "updated video")
        result = self.execute(self.script, "lesson", "another-title")
        self.assertNotEqual(result.returncode, 0)
        other = self.write(self.project / "out/final/other.mp4", "other video")
        result = self.execute(self.script, "other", "CUSTOM-TITLE")
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(self.final.exists())
        self.assertTrue(other.exists())


class FinalGateTests(unittest.TestCase):
    def setUp(self):
        self.module = load_script("verify-final.py")
        self.info = {"streams": [{"codec_type": "video", "width": 1080, "height": 1920, "avg_frame_rate": "30/1"},
                                  {"codec_type": "audio"}], "format": {"duration": "70"}}

    def inspect(self, loudness="-14.0", peak="-1.5", black=""):
        with (patch.object(self.module, "output", return_value=json.dumps(self.info)),
              patch.object(self.module, "ffmpeg_log", side_effect=[f"  I: {loudness} LUFS\n  Peak: {peak} dBFS\n", black]),
              contextlib.redirect_stdout(io.StringIO())):
            return self.module.technical_checks("video.mp4")

    def test_valid_master_passes(self):
        self.assertEqual(self.inspect(), [])

    def test_black_frames_silence_loudness_and_peak_fail(self):
        for kwargs in ({"black": "black_start:0 black_end:0.1"}, {"loudness": "-inf"},
                       {"loudness": "-20"}, {"peak": "0.2"}):
            with self.subTest(kwargs=kwargs):
                self.assertTrue(self.inspect(**kwargs))

    def test_invalid_dimensions_fps_and_missing_stream_fail(self):
        for prop, value in (("width", 1920), ("avg_frame_rate", "0/0")):
            with self.subTest(prop=prop):
                original = self.info["streams"][0][prop]
                self.info["streams"][0][prop] = value
                self.assertTrue(self.inspect())
                self.info["streams"][0][prop] = original
        self.info["streams"].pop()
        self.assertTrue(self.inspect())

    def test_missing_file_arguments_fail(self):
        with patch.object(sys, "argv", ["verify-final.py"]), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as error:
                self.module.main()
        self.assertEqual(error.exception.code, 2)

    def test_failed_technical_gate_never_runs_whisper(self):
        with (patch.object(sys, "argv", ["verify-final.py", "video.mp4"]),
              patch.object(self.module, "project_root"), patch.object(self.module, "technical_checks", return_value=["bad"]),
              patch.object(self.module, "check_voice") as voice,
              contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO())):
            self.assertEqual(self.module.main(), 1)
            voice.assert_not_called()


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.module = load_script("preflight-audio.py")

    def test_mix_and_sfx_finish_in_order_before_analysis(self):
        events = []
        def popen(command, **kwargs):
            events.append("start")
            def wait(**kwargs):
                events.append("finish")
                return 0
            return Mock(wait=wait)
        with (patch.object(sys, "argv", ["preflight-audio.py", "Lesson", "lesson"]),
              patch.object(self.module, "project_root"), patch.object(self.module.Path, "mkdir"),
              patch.object(self.module, "popen", side_effect=popen),
              patch.object(self.module, "run", side_effect=lambda *a, **k: events.append("analysis"))):
            self.module.main()
        self.assertEqual(events, ["start", "finish", "start", "finish", "analysis"])

    def test_failed_first_render_stops_pipeline(self):
        with (patch.object(sys, "argv", ["preflight-audio.py", "Lesson", "lesson"]),
              patch.object(self.module, "project_root"), patch.object(self.module.Path, "mkdir"),
              patch.object(self.module, "popen", return_value=Mock(wait=Mock(return_value=23))) as popen,
              patch.object(self.module, "run") as analysis):
            with self.assertRaises(SystemExit) as error:
                self.module.main()
        self.assertEqual(error.exception.code, 23)
        self.assertEqual(popen.call_count, 1)
        analysis.assert_not_called()

    def test_timeout_reaps_owned_process(self):
        job = Mock(pid=12345, wait=Mock(side_effect=[subprocess.TimeoutExpired("render", 600), 0]))
        with (patch.object(self.module, "popen", return_value=job),
              patch.object(subprocess, "run") as terminate,
              patch.object(os, "killpg", create=True) as killpg):
            with self.assertRaises(subprocess.TimeoutExpired):
                self.module.render_audio(["render"], {})
            self.assertEqual(job.wait.call_count, 2)
            if os.name == "nt":
                self.assertEqual(terminate.call_args.args[0], ["taskkill", "/PID", "12345", "/T", "/F"])
            else:
                killpg.assert_called_once()


class StylePolicyTests(IsolatedFiles):
    def setUp(self):
        super().setUp()
        self.project = self.base / "project"
        self.script = self.project / "scripts/check-style-novelty.py"
        self.write(self.script, (SCRIPTS / "check-style-novelty.py").read_text(encoding="utf-8"))
        self.write(self.project / "src/talking/style.tsx", (ROOT / "assets/template/src/talking/style.tsx").read_text(encoding="utf-8"))
        self.write(self.project / "src/videos/registry.tsx", """import {BASE_DATA, BaseShort} from './lesson/lesson-short';
import {NEXT_DATA, NextShort} from './lesson-new/lesson-new-short';
const VIDEOS = [
  {data: BASE_DATA, style: 'bold-news'},
  {data: NEXT_DATA, style: 'bold-news'},
];
""")
        self.write(self.project / "src/videos/lesson-new/lesson-new-short.tsx", "const BEATS = [];\n")

    def policy(self, **values):
        self.write(self.project / ".style-policy.json", json.dumps(values))

    def test_common_slug_prefix_does_not_bypass_new_style_gate(self):
        result = self.execute(self.script, "lesson-new")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("đã dùng cho lesson", result.stdout)

    def test_brief_can_reuse_brand_style(self):
        self.policy(requireNewStyle=False)
        result = self.execute(self.script, "lesson-new")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("giữ nhận diện", result.stdout)

    def test_explicit_version_can_share_style(self):
        self.policy(variants={"lesson-new": "lesson"})
        result = self.execute(self.script, "lesson-new")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_market_is_only_enforced_when_requested(self):
        self.policy(requireNewStyle=False)
        self.write(self.project / "src/videos/lesson-new/lesson-new-short.tsx", "const BEATS = [{kind: 'broll', clip: 'mixkit-42'}];")
        self.write(self.project / "public/broll/people-tags.jsonl", json.dumps({"id": "42", "people": "western", "faces": True}))
        # Only ffprobe orientation is stubbed; run all policy/gate code.
        def probe(*args, **kwargs):
            return types.SimpleNamespace(stdout="1920,1080", returncode=0)
        for allowed, expected in ((None, 0), (["asian"], 1)):
            self.policy(requireNewStyle=False, allowedPeople=allowed)
            code = 0
            with (patch.object(sys, "argv", [str(self.script), "lesson-new"]),
                  patch.object(subprocess, "run", side_effect=probe),
                  contextlib.redirect_stdout(io.StringIO())):
                try:
                    runpy.run_path(str(self.script), run_name="__main__")
                except SystemExit as error:
                    code = error.code
            self.assertEqual(code, expected)

    def test_invalid_policy_cannot_silently_disable_gate(self):
        self.policy(requireNewStyle="false")
        result = self.execute(self.script, "lesson-new")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("boolean", result.stderr)


class NewVideoTests(IsolatedFiles):
    def setUp(self):
        super().setUp()
        self.skill = self.base / "skill"
        self.script = self.write(self.skill / "scripts/new-video.py", (ROOT / "scripts/new-video.py").read_text(encoding="utf-8"))
        self.write(self.skill / "assets/video-template.tsx", (ROOT / "assets/video-template.tsx").read_text(encoding="utf-8"))
        self.project = self.base / "project"
        self.write(self.project / "package.json", "{}")
        self.write(self.project / "src/talking/style.tsx", "const STYLES = {\n  'style-2': {\n  },\n} satisfies Style;")
        self.registry = self.write(self.project / "src/videos/registry.tsx", "// @imports\nconst VIDEOS = [\n  // @entries\n];\n")
        self.source = self.write(self.base / "source.mp4", "source")
        self.commands = []
        self.platform = types.ModuleType("cross_platform")
        self.platform.die = lambda message: (_ for _ in ()).throw(SystemExit(message))
        self.platform.duration = lambda _: 5.0
        self.platform.output = lambda _: "generated"
        self.platform.run = lambda command, **kwargs: self.commands.append(list(command))
        for helper in ("this_python", "uv_python", "venv_cmd"):
            setattr(self.platform, helper, lambda *args, **kwargs: list(map(str, args)))

    def run_video(self, slug):
        original = Path.cwd()
        try:
            with (patch.object(sys, "argv", [str(self.script), str(self.project), str(self.source), slug]),
                  patch.object(sys, "path", sys.path.copy()), patch.dict(sys.modules, {"cross_platform": self.platform}),
                  contextlib.redirect_stdout(io.StringIO())):
                runpy.run_path(str(self.script), run_name="__main__")
        finally:
            os.chdir(original)

    def test_clean_template_creates_edl_parent_and_valid_numeric_identifiers(self):
        self.run_video("123-lesson")
        edit = json.loads((self.project / "scripts/edits/123-lesson.json").read_text(encoding="utf-8"))
        self.assertGreater(edit["sections"][0][2], 0)
        registry = self.registry.read_text(encoding="utf-8")
        self.assertIn("id: 'Video123Lesson'", registry)
        self.assertIn("VIDEO_123_LESSON_DATA", registry)
        self.assertIn("style: 'style-2'", registry)
        self.assertIn(["npx", "--no-install", "tsc", "--noEmit"], self.commands)

    def test_invalid_registry_is_rejected_before_media_processing(self):
        self.registry.write_text("const VIDEOS = [];")
        with self.assertRaises(SystemExit):
            self.run_video("lesson")
        self.assertEqual(self.commands, [])
        self.assertFalse((self.project / "scripts/edits").exists())

    def test_registry_marker_indentation_does_not_drop_composition(self):
        self.registry.write_text("// @imports\nconst VIDEOS = [\n// @entries\n];\n")
        self.run_video("lesson")
        self.assertIn("id: 'Lesson'", self.registry.read_text(encoding="utf-8"))

    def test_colliding_composition_id_is_rejected_before_media_processing(self):
        self.registry.write_text("// @imports\nconst VIDEOS = [{id: 'Video123Lesson'}];\n// @entries\n")
        with self.assertRaises(SystemExit):
            self.run_video("123-lesson")
        self.assertEqual(self.commands, [])


class MasterRecoveryTests(IsolatedFiles):
    def test_encoding_failure_keeps_previous_master_and_removes_partial_file(self):
        project = self.base / "project"
        script = self.write(project / "scripts/master-loudness.py", (SCRIPTS / "master-loudness.py").read_text(encoding="utf-8"))
        source = self.write(project / "out/lesson.mp4", "raw")
        final = self.write(project / "out/final/lesson.mp4", "good master")
        platform = types.ModuleType("cross_platform")
        def project_root(_):
            os.chdir(project)
        def run(command, **kwargs):
            if "-c:v" in command:
                Path(command[-1]).write_text("partial encode")
                raise SystemExit(23)
            return types.SimpleNamespace(stderr=json.dumps({"input_i": -20, "input_tp": -3,
                         "input_lra": 1, "input_thresh": -30, "target_offset": 0}))
        platform.project_root, platform.run = project_root, run
        original = Path.cwd()
        try:
            with (patch.object(sys, "argv", [str(script), str(source)]),
                  patch.dict(sys.modules, {"cross_platform": platform})):
                with self.assertRaises(SystemExit) as error:
                    runpy.run_path(str(script), run_name="__main__")
            self.assertEqual(error.exception.code, 23)
            self.assertEqual(final.read_text(), "good master")
            self.assertEqual(list(final.parent.iterdir()), [final])
        finally:
            os.chdir(original)


if __name__ == "__main__":
    unittest.main()
