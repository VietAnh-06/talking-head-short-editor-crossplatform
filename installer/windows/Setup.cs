// Compile with Windows' .NET Framework compiler; no SDK or external build packages required.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

[assembly: AssemblyTitle("Talking Head Short Editor Setup")]
[assembly: AssemblyProduct("Talking Head Short Editor")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace TalkingHeadSetup
{
    public static class Installer
    {
        public static string UserDirectory
        {
            get
            {
                string path = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile,
                    Environment.SpecialFolderOption.DoNotVerify);
                if (String.IsNullOrEmpty(path)) path = Environment.GetEnvironmentVariable("USERPROFILE");
                if (String.IsNullOrEmpty(path)) throw new IOException("Không xác định được thư mục tài khoản Windows.");
                return Path.GetFullPath(path);
            }
        }

        public static string NormalizeDirectory(string value)
        {
            if (String.IsNullOrWhiteSpace(value))
                throw new ArgumentException("Hãy chọn thư mục project.");
            string path = Path.GetFullPath(Environment.ExpandEnvironmentVariables(value.Trim().Trim('"')));
            if (path != Path.GetPathRoot(path)) path = path.TrimEnd('\\', '/');
            return path;
        }

        public static void ValidateDirectory(string path)
        {
            string skill = Path.Combine(UserDirectory, ".claude", "skills", "talking-head-short-editor");
            string prefix = path.TrimEnd('\\') + "\\";
            string skillPrefix = skill.TrimEnd('\\') + "\\";
            if (prefix.StartsWith(skillPrefix, StringComparison.OrdinalIgnoreCase) ||
                skillPrefix.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                throw new IOException("Hãy chọn thư mục project riêng, bên ngoài thư mục skill của Claude Code.");
            if (File.Exists(path)) throw new IOException("Đường dẫn đã chọn là một file. Hãy chọn thư mục khác.");
            if (!Directory.Exists(path))
            {
                string parent = Path.GetDirectoryName(path);
                while (!String.IsNullOrEmpty(parent) && !Directory.Exists(parent))
                {
                    if (File.Exists(parent)) throw new IOException("Một phần đường dẫn đã chọn là một file.");
                    parent = Path.GetDirectoryName(parent);
                }
                if (String.IsNullOrEmpty(parent)) throw new IOException("Không tìm thấy ổ đĩa hoặc thư mục gốc đã chọn.");
                return;
            }
            string marker = Path.Combine(path, ".talking-head-setup");
            if (File.Exists(marker))
            {
                string state = File.ReadAllText(marker).Trim();
                if (state == "installing" || state == "complete") return;
                throw new IOException("Trạng thái cài đặt trong thư mục này không hợp lệ. Hãy chọn thư mục khác.");
            }
            if (Directory.GetFileSystemEntries(path).Length != 0)
                throw new IOException("Thư mục đã có dữ liệu khác. Hãy chọn thư mục trống hoặc project do bộ cài này tạo.");
        }

        public static void ExtractArchive(Stream source, string directory)
        {
            string root = Path.GetFullPath(directory).TrimEnd('\\', '/') + Path.DirectorySeparatorChar;
            Directory.CreateDirectory(root);
            using (ZipArchive archive = new ZipArchive(source, ZipArchiveMode.Read, true))
            {
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string target = Path.GetFullPath(Path.Combine(root, entry.FullName));
                    if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Gói cài đặt chứa đường dẫn không hợp lệ.");
                    if (String.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(target);
                        continue;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (Stream input = entry.Open())
                    using (Stream output = new FileStream(target, FileMode.CreateNew, FileAccess.Write))
                        input.CopyTo(output);
                }
            }
        }

        public static void ExtractPayload(string directory)
        {
            using (Stream source = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
            {
                if (source == null) throw new InvalidDataException("Không tìm thấy dữ liệu bộ cài.");
                ExtractArchive(source, directory);
            }
            foreach (string file in new string[] { "setup-windows.ps1", "SKILL.md", "README-CAI-DAT.md",
                "scripts/install.py", "assets/template/package-lock.json" })
            {
                if (!File.Exists(Path.Combine(directory, file)))
                    throw new InvalidDataException("Gói cài đặt thiếu file: " + file);
            }
        }

        public static void CleanupPayload(string directory)
        {
            string full = Path.GetFullPath(directory);
            string temp = Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\', '/');
            if (!String.Equals(Path.GetDirectoryName(full), temp, StringComparison.OrdinalIgnoreCase) ||
                !Regex.IsMatch(Path.GetFileName(full), @"^talking-head-installer-[a-f0-9]{32}$"))
                throw new IOException("Từ chối xóa thư mục nằm ngoài vùng giải nén của bộ cài.");
            if (Directory.Exists(full)) Directory.Delete(full, true);
        }

        public static ProcessStartInfo CreateStartInfo(string script, string project, bool skipProject)
        {
            // EncodedCommand preserves Unicode, apostrophes and shell metacharacters in paths.
            string command = "$ErrorActionPreference = 'Stop'\n" +
                "$ProgressPreference = 'SilentlyContinue'\n" +
                "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)\n" +
                "& '" + script.Replace("'", "''") + "' -NonInteractive -ProjectDirectory '" +
                project.Replace("'", "''") + "'" + (skipProject ? " -SkipProject" : "") +
                "\nif (-not $?) { if ($LASTEXITCODE) { exit $LASTEXITCODE }; exit 1 }\nexit 0\n";
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),
                @"WindowsPowerShell\v1.0\powershell.exe");
            info.Arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand " +
                Convert.ToBase64String(Encoding.Unicode.GetBytes(command));
            info.WorkingDirectory = Path.GetDirectoryName(script);
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.WindowStyle = ProcessWindowStyle.Hidden;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.StandardOutputEncoding = Encoding.UTF8;
            info.StandardErrorEncoding = Encoding.UTF8;
            info.EnvironmentVariables["PYTHONUTF8"] = "1";
            return info;
        }

        public static int RunScript(string script, string project, bool skipProject, Action<string> output)
        {
            using (Process process = new Process())
            {
                process.StartInfo = CreateStartInfo(script, project, skipProject);
                process.OutputDataReceived += delegate(object sender, DataReceivedEventArgs e)
                    { if (e.Data != null) output(e.Data); };
                process.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs e)
                    { if (e.Data != null) output(e.Data); };
                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                process.WaitForExit();
                return process.ExitCode;
            }
        }
    }

    public sealed class SetupForm : Form
    {
        private readonly TextBox destination = new TextBox();
        private readonly Button browse = new Button();
        private readonly CheckBox skillOnly = new CheckBox();
        private readonly TextBox details = new TextBox();
        private readonly Label status = new Label();
        private readonly ProgressBar progress = new ProgressBar();
        private readonly Button install = new Button();
        private readonly Button openFolder = new Button();
        private readonly Button openLog = new Button();
        private readonly Button close = new Button();
        private bool running;
        private string logPath;
        private readonly object logLock = new object();
        private StreamWriter log;
        public int ResultCode { get; private set; }

        public SetupForm()
        {
            Text = "Cài đặt Talking Head Short Editor";
            Font = new Font("Segoe UI", 10F);
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(780, 630);
            MinimumSize = new Size(740, 620);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.White;
            var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(24),
                ColumnCount = 1, RowCount = 8 };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 65));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 66));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 24));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));
            layout.Controls.Add(new Label { Text = "Talking Head Short Editor", Dock = DockStyle.Fill,
                Font = new Font("Segoe UI", 21F, FontStyle.Bold), ForeColor = Color.FromArgb(25, 43, 65) }, 0, 0);
            layout.Controls.Add(new Label { Dock = DockStyle.Fill,
                Text = "Chọn nơi đặt project, sau đó bấm Cài đặt. Có thể chọn ổ D, E hoặc ổ khác.\n" +
                    "Cần Internet và ít nhất 20 GB trống. Các công cụ và cache dùng chung theo cấu hình máy." }, 0, 1);
            var pathLayout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 2 };
            pathLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            pathLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150));
            pathLayout.Controls.Add(new Label { Text = "Thư mục project", AutoSize = true }, 0, 0);
            destination.Text = Path.Combine(Installer.UserDirectory, "videos", "talking-head-shorts");
            destination.Dock = DockStyle.Fill;
            pathLayout.Controls.Add(destination, 0, 1);
            browse.Text = "Chọn thư mục…";
            browse.Dock = DockStyle.Fill;
            browse.Click += Browse;
            pathLayout.Controls.Add(browse, 1, 1);
            layout.Controls.Add(pathLayout, 0, 2);
            skillOnly.Text = "Chỉ cài công cụ và skill, tạo project sau";
            skillOnly.Dock = DockStyle.Fill;
            layout.Controls.Add(skillOnly, 0, 3);
            status.Text = "Sẵn sàng cài đặt.";
            status.Dock = DockStyle.Fill;
            status.TextAlign = ContentAlignment.MiddleLeft;
            layout.Controls.Add(status, 0, 4);
            progress.Dock = DockStyle.Fill;
            layout.Controls.Add(progress, 0, 5);
            details.Multiline = true;
            details.ReadOnly = true;
            details.ScrollBars = ScrollBars.Both;
            details.WordWrap = false;
            details.Dock = DockStyle.Fill;
            details.BackColor = Color.FromArgb(245, 247, 250);
            details.Font = new Font("Consolas", 9F);
            details.Margin = new Padding(0, 12, 0, 0);
            layout.Controls.Add(details, 0, 6);
            var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft,
                Padding = new Padding(0, 12, 0, 0), WrapContents = false };
            close.Text = "Đóng";
            close.Click += delegate { Close(); };
            install.Text = "Cài đặt";
            install.BackColor = Color.FromArgb(25, 108, 80);
            install.ForeColor = Color.White;
            install.FlatStyle = FlatStyle.Flat;
            install.Click += StartInstallation;
            openFolder.Text = "Mở project";
            openFolder.Visible = false;
            openFolder.Click += delegate { OpenPath(destination.Text); };
            openLog.Text = "Xem log";
            openLog.Enabled = false;
            openLog.Click += delegate { OpenPath(logPath); };
            foreach (Button button in new Button[] { close, install, openFolder, openLog })
            {
                button.Size = new Size(110, 32);
                buttons.Controls.Add(button);
            }
            layout.Controls.Add(buttons, 0, 7);
            Controls.Add(layout);
            AcceptButton = install;
            FormClosing += delegate(object sender, FormClosingEventArgs e)
            {
                if (!running) return;
                e.Cancel = true;
                MessageBox.Show(this, "Đang cài công cụ hoặc tạo project. Hãy đợi tiến trình hoàn tất rồi đóng cửa sổ.",
                    Text, MessageBoxButtons.OK, MessageBoxIcon.Information);
            };
        }

        private void Browse(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Chọn hoặc tạo thư mục project (có thể ở ổ D, E hoặc ổ ngoài).";
                dialog.ShowNewFolderButton = true;
                if (Directory.Exists(destination.Text)) dialog.SelectedPath = destination.Text;
                if (dialog.ShowDialog(this) == DialogResult.OK) destination.Text = dialog.SelectedPath;
            }
        }

        private void OpenPath(string path)
        {
            try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); }
            catch (Exception error) { MessageBox.Show(this, error.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error); }
        }

        private void AppendOutput(string line)
        {
            lock (logLock) { if (log != null) log.WriteLine(line); }
            BeginInvoke(new Action(delegate
            {
                // Keep the window responsive on long npm/pip logs; the full output remains in the log file.
                if (details.TextLength > 250000) details.Clear();
                details.AppendText(line + Environment.NewLine);
            }));
        }

        private async void StartInstallation(object sender, EventArgs e)
        {
            string project;
            bool skip = skillOnly.Checked;
            try
            {
                project = Installer.NormalizeDirectory(destination.Text);
                if (!skip) Installer.ValidateDirectory(project);
                destination.Text = project;
                string localData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData,
                    Environment.SpecialFolderOption.DoNotVerify);
                if (String.IsNullOrEmpty(localData)) localData = Environment.GetEnvironmentVariable("LOCALAPPDATA");
                if (String.IsNullOrEmpty(localData)) localData = Path.Combine(Installer.UserDirectory, "AppData", "Local");
                string logs = Path.Combine(localData, "talking-head-short-editor", "logs");
                Directory.CreateDirectory(logs);
                logPath = Path.Combine(logs, "installer-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" +
                    Guid.NewGuid().ToString("N").Substring(0, 8) + ".log");
                log = new StreamWriter(logPath, false, new UTF8Encoding(false)) { AutoFlush = true };
            }
            catch (Exception error)
            {
                MessageBox.Show(this, error.Message, "Chưa thể cài đặt", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            running = true;
            ResultCode = 1;
            install.Enabled = browse.Enabled = destination.Enabled = skillOnly.Enabled = close.Enabled = false;
            openFolder.Visible = false;
            openLog.Enabled = true;
            progress.Style = ProgressBarStyle.Marquee;
            status.Text = "Đang cài đặt… Lần đầu có thể mất nhiều phút. Windows có thể hỏi quyền cài công cụ.";
            details.Clear();
            string payload = Path.Combine(Path.GetTempPath(), "talking-head-installer-" + Guid.NewGuid().ToString("N"));
            try
            {
                int code = await Task.Run(delegate
                {
                    AppendOutput("Log: " + logPath);
                    AppendOutput("Thư mục project: " + project);
                    Installer.ExtractPayload(payload);
                    return Installer.RunScript(Path.Combine(payload, "setup-windows.ps1"), project, skip, AppendOutput);
                });
                ResultCode = code;
                if (code == 0)
                {
                    status.Text = "Cài đặt thành công.";
                    install.Visible = false;
                    openFolder.Visible = !skip;
                    AppendOutput(skip ? "Đã cài công cụ và skill. Có thể tạo project sau." :
                        "Mở terminal mới tại project, chạy: npm run studio");
                    AppendOutput("Cài Claude Code và đăng nhập để dùng skill: https://claude.com/claude-code");
                }
                else
                {
                    status.Text = "Cài đặt chưa hoàn tất (mã " + code + "). Xem log, sửa nguyên nhân rồi bấm Thử lại.";
                    install.Text = "Thử lại";
                }
            }
            catch (Exception error)
            {
                status.Text = "Cài đặt chưa hoàn tất. Xem log rồi thử lại.";
                install.Text = "Thử lại";
                AppendOutput(error.ToString());
            }
            finally
            {
                try { Installer.CleanupPayload(payload); }
                catch (Exception error) { AppendOutput("Không dọn được thư mục tạm: " + error.Message); }
                lock (logLock) { log.Dispose(); log = null; }
                running = false;
                progress.Style = ProgressBarStyle.Blocks;
                progress.Value = ResultCode == 0 ? 100 : 0;
                install.Enabled = browse.Enabled = destination.Enabled = skillOnly.Enabled = close.Enabled = true;
                if (ResultCode == 0) destination.Enabled = browse.Enabled = skillOnly.Enabled = false;
            }
        }
    }

    internal static class Program
    {
        [STAThread]
        private static int Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            if (!Environment.Is64BitOperatingSystem || Environment.OSVersion.Version.Build < 19044)
            {
                MessageBox.Show("Cần Windows 10 21H2 trở lên hoặc Windows 11, máy Intel/AMD 64-bit.",
                    "Talking Head Short Editor", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
            bool first;
            using (var mutex = new Mutex(true, @"Local\TalkingHeadShortEditorSetup", out first))
            {
                if (!first)
                {
                    MessageBox.Show("Bộ cài đang mở. Hãy tiếp tục trong cửa sổ hiện có.", "Talking Head Short Editor");
                    return 1;
                }
                try
                {
                    using (var form = new SetupForm()) { Application.Run(form); return form.ResultCode; }
                }
                finally { mutex.ReleaseMutex(); }
            }
        }
    }
}
