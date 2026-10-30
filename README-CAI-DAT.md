# Skill dựng video ngắn `talking-head-short-editor` (bản đa nền tảng: Windows, macOS, Linux)

Skill cho Claude Code. Đầu vào là clip quay một người nói trước máy, hoặc kịch bản đã duyệt để máy đọc giọng (VieNeu-TTS). Đầu ra là video dọc 1080×1920 kiểu TikTok/Reels, dựng bằng Remotion: có phụ đề, B-roll, SFX, nhạc nền, bìa, master −14 LUFS, và mỗi video một style riêng.

Bản này đóng gói ngày 26/10/2026 và mọi bước đều chạy trên máy của bạn. Đã bỏ phần render chia ra nhiều máy chủ. Render bằng `npx remotion render` theo `references/edit-workflow.md`.

## Bản đa nền tảng (Windows, macOS, Linux)

Bản này chạy thẳng trên Windows và macOS, **không cần WSL2**. Mọi script Bash cũ đã viết lại bằng Python và chạy qua `uv run`, nên cùng một lệnh dùng được trên cả ba hệ điều hành. Các thay đổi:

- `scripts/*.sh` → `scripts/*.py`. Gọi bằng `uv run scripts/<tên>.py …`, không chạy `./scripts/x.py` trực tiếp.
- Python trong venv gọi bằng `uv run -p .venv-align python …`. uv tự tìm `Scripts\python.exe` trên Windows hoặc `bin/python` trên macOS/Linux.
- Không còn cần `jq`. DeepFilterNet (`denoise-voice.py`) tự tải đúng bản cho Windows x64, macOS Apple Silicon/Intel hoặc Linux x64, có kiểm SHA-256.
- Trên Windows, `qa-frames.mjs` chép `public/` vào bundle thay vì tạo symlink (symlink cần Developer Mode). Cần thêm chỗ trống bằng dung lượng `public/`.

Yêu cầu chung: Node.js 22+, FFmpeg, ImageMagick 7 (`magick`), uv, Git, Internet. Nên có ít nhất 16 GB RAM và 20 GB ổ trống cho môi trường, model và cache; footage/render cần thêm dung lượng.

## Cài tự động trên Windows

Yêu cầu: Windows 11 hoặc Windows 10 21H2 trở lên, máy Intel/AMD 64-bit (chưa hỗ trợ Windows ARM), có `winget` (App Installer).

1. Mở **`talking-head-short-editor-setup.exe`**. Đây là bộ cài một file, đã chứa skill, template và các script; không cần giải nén hay cài Python trước. Nhập đường dẫn hoặc bấm **Chọn thư mục…**, ví dụ `D:\Video Projects\kenh-cua-toi`, rồi bấm **Cài đặt**. Có thể chọn ổ D, E hoặc ổ khác.
2. Bộ cài dùng `winget` để cài những gì còn thiếu: Git, Node.js LTS, FFmpeg, ImageMagick, uv. Với Node.js, bộ cài kiểm tra phiên bản trước: chưa có thì cài bản LTS, đã có từ 22 trở lên thì giữ nguyên, dưới 22 thì tự nâng cấp bằng `winget upgrade` (dùng bộ cài LTS nếu bản cũ không được nhận diện), rồi kiểm tra lại trước khi tiếp tục. Bạn không cần tự gỡ Node.js cũ. Windows có thể hiện hộp thoại quyền quản trị. Bộ cài đặt biến người dùng `PYTHONUTF8=1` để script in được tiếng Việt.
3. Skill được chép vào `%USERPROFILE%\.claude\skills\talking-head-short-editor`. Bản cũ (nếu có) được chuyển vào `%USERPROFILE%\.local\share\talking-head-setup\backups\`.
4. Project nằm đúng tại thư mục đã chọn, mặc định là `%USERPROFILE%\videos\talking-head-shorts`. Bộ cài chạy npm, tạo môi trường Whisper và VieNeu, sinh nhạc, tải SFX, kiểm TypeScript và thử mở trình duyệt render. **Whisper large-v3 (~3 GB) và model VieNeu chỉ tải khi dùng lần đầu.**

Tiến trình và lỗi hiện trong cửa sổ bộ cài; bấm **Xem log** để mở log đầy đủ. Khi cài lỗi, sửa nguyên nhân rồi bấm **Thử lại** với cùng thư mục. Khi hoàn tất, bấm **Mở project**. Có thể chọn **Chỉ cài công cụ và skill, tạo project sau**. Trong lúc cài, hãy chờ tiến trình kết thúc trước khi đóng cửa sổ.

Bộ cài cần Internet để tải công cụ và các gói phụ thuộc, chưa phải bản cài offline. Bản build từ mã nguồn hiện chưa ký số. Chạy bộ cài bằng tài khoản sử dụng Claude Code; các công cụ cần quyền quản trị sẽ tự yêu cầu quyền riêng.

Nếu dùng bản mã nguồn, vẫn có thể giải nén toàn bộ thư mục rồi chạy `setup-windows.cmd` hoặc dùng PowerShell như dưới đây.

Chạy trong PowerShell để chỉ định đường dẫn trực tiếp, chọn tên mặc định, hoặc chỉ cài công cụ và skill:

```powershell
.\setup-windows.cmd -ProjectDirectory "D:\Video Projects\kenh-cua-toi"
.\setup-windows.cmd -ProjectName kenh-cua-toi
.\setup-windows.cmd -NonInteractive -ProjectName kenh-cua-toi
.\setup-windows.cmd -SkipProject
```

`-ProjectDirectory` là **thư mục project cuối cùng**, không tự nối thêm tên project. Nếu truyền cả `-ProjectDirectory` và `-ProjectName`, đường dẫn được ưu tiên. Đường dẫn có khoảng trắng hoặc tiếng Việt được hỗ trợ; đặt trong ngoặc kép khi truyền tham số. `-NonInteractive` bỏ qua câu hỏi và dùng đường dẫn mặc định nếu không có `-ProjectDirectory`. `-SkipProject` cũng bỏ qua câu hỏi.

`node_modules`, `.venv-align`, `.venv-vieneu`, nhạc, SFX, footage, model VieNeu và video xuất nằm trong project trên ổ đã chọn. Skill vẫn ở thư mục tài khoản để Claude Code nhận diện. **Lựa chọn này không chuyển vị trí công cụ do winget cài, Python do uv quản lý hay cache dùng chung của npm, uv và Whisper**; các phần đó vẫn có thể dùng ổ C theo cấu hình hệ thống. Bộ cài cũng không di chuyển project cũ sang vị trí mới.

Sau khi cài, **mở cửa sổ terminal mới** để PATH có hiệu lực. Cài Claude Code cho Windows rồi đăng nhập; Claude Code đọc skill trong `%USERPROFILE%\.claude\skills` nên tự nhận skill. Mở Studio:

```powershell
cd $HOME\videos\talking-head-shorts
npm run studio
```

Nếu chọn ổ D, thay dòng `cd` bằng đường dẫn thực tế, ví dụ `cd "D:\Video Projects\kenh-cua-toi"`. Tương tự, thay đường dẫn project trong lệnh tạo video dưới đây bằng thư mục đã chọn.

Tạo video từ file trên ổ Windows (Claude Code chạy lệnh qua Git Bash; dùng dấu `/` và đặt đường dẫn có khoảng trắng trong ngoặc kép):

```bash
uv run ~/.claude/skills/talking-head-short-editor/scripts/new-video.py \
  ~/videos/talking-head-shorts "C:/Users/TenBan/Videos/clip.mp4" video-dau-tien
```

Nếu cài lỗi, đọc thông báo ngay phía trên và log trong `%LOCALAPPDATA%\talking-head-short-editor\logs`, sửa nguyên nhân rồi chạy lại **với cùng đường dẫn project** (nhập lại khi được hỏi hoặc dùng `-ProjectDirectory`). Project cài dở được tiếp tục; project đã cài xong được giữ lại; thư mục chứa dữ liệu khác bị từ chối trước khi cài công cụ, khi đó hãy chọn thư mục trống khác.

### Đóng gói bộ cài `.exe` từ mã nguồn

Trên Windows x64, tại thư mục mã nguồn, chạy:

```powershell
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\build-windows-installer.ps1
```

Kết quả: `dist/talking-head-short-editor-setup.exe` và file kiểm tra SHA-256 `.exe.sha256`. Chỉ cần gửi file `.exe` cho người dùng. Dùng `-OutputDirectory "D:\Releases"` nếu muốn đổi nơi lưu bản build. Mỗi lần sửa skill/template/script, chạy lại lệnh build để cập nhật nội dung trong `.exe`.

Luồng build dùng trình biên dịch .NET Framework có sẵn trong Windows, không cần cài Inno Setup, SDK .NET hay Python. `.exe` chứa giao diện Windows Forms và gói dữ liệu nhúng, sau đó gọi `setup-windows.ps1` bằng Windows PowerShell. Source nằm trong `installer/windows/`; build chỉ lấy mã nguồn, tài liệu và font, bỏ qua môi trường ảo, `node_modules`, cache và output. File build nằm ngoài Git.

## Cài tự động trên macOS

Yêu cầu: máy Mac Apple Silicon hoặc Intel đã cài [Homebrew](https://brew.sh).

```bash
cd ~/Downloads/talking-head-short-editor-crossplatform   # thư mục đã giải nén
bash setup-macos.sh                                      # hoặc: bash setup-macos.sh --project-name kenh-cua-toi
bash setup-macos.sh --project-dir "/Volumes/Video SSD/kenh-cua-toi"
bash setup-macos.sh --skip-project                       # chỉ cài công cụ và skill
```

Bộ cài dùng `brew install` cho những gì còn thiếu (node, ffmpeg, imagemagick, uv, git). Node.js từ 22 trở lên được giữ nguyên; nếu chưa có thì cài, nếu dưới 22 thì nâng cấp bằng `brew upgrade node` khi Homebrew đã quản lý gói `node`, hoặc cài gói này khi bản cũ được cài theo cách khác. Bộ cài dùng Node.js vừa cài/nâng cấp trong phiên setup và kiểm tra lại phiên bản trước khi tiếp tục. Sau đó chép skill vào `~/.claude/skills/talking-head-short-editor`, rồi tạo project tại `~/videos/talking-head-shorts` giống như trên Windows. Log nằm ở `~/Library/Logs/talking-head-short-editor/`. Sau đó cài Claude Code và đăng nhập.

Trên macOS, dùng `--project-dir` để chọn thư mục khác hoặc ổ ngoài; nếu không truyền thì dùng `~/videos/<tên>`. Tham số được chuyển nguyên vẹn tới bộ cài Python, không có câu hỏi chọn thư mục trên macOS.

Nếu dùng trình quản lý phiên bản như nvm/fnm/Volta, cấu hình của trình quản lý đó có thể chọn lại Node.js cũ khi mở terminal mới; hãy chọn Node.js từ 22 trở lên trong trình quản lý đó trước khi chạy Studio.

## Cài thủ công (Linux hoặc khi không muốn dùng bộ cài)

1. Cài Node 22+ và npm, FFmpeg (`ffmpeg`, `ffprobe`), uv, ImageMagick (`magick`; ImageMagick 6 vẫn chạy `mixkit-thumbs.py`) và Git.
2. Từ thư mục đã giải nén: `uv run scripts/install.py [--project-name <tên>] [--project-dir <thư-mục>] [--skip-project]`. Ví dụ chọn ổ khác trên Linux: `uv run scripts/install.py --project-dir "/mnt/video/kenh-cua-toi"`. Hoặc chép thư mục vào `~/.claude/skills/talking-head-short-editor/` rồi để Claude Code tự chạy `uv run scripts/new-project.py <thư-mục>` khi dựng video đầu tiên. Nếu tạo project lỗi giữa chừng, chạy lại `uv run scripts/new-project.py <cùng-thư-mục> --resume`.
3. Mở Claude Code và nhờ nó dựng video, ví dụ "dựng video talking head từ file X" hoặc "làm video giọng đọc AI từ kịch bản này".
4. Video có giọng máy: lần đầu, `tts-build.py` tải model VieNeu-TTS v3 Turbo từ Hugging Face.

Kiểm bộ cài (không tải gì, không đổi hệ thống): `uv run python -m unittest discover -s tests -v`.

## Lưu ý
- **Render:** render 70–90 s video mất 4–9 phút trên CPU 16 luồng. Mỗi lúc chỉ chạy một render, vì hai render cùng lúc dễ treo hoặc hết RAM.
- **Nhạc nền:** không kèm file `.wav`. `new-project.py` tự sinh lại bằng `scripts/generate-music-beds.py`.
- **Ví dụ và quy tắc:** các ví dụ (LETCO, kênh du học Hàn, mã video như `tien-015`, `tinhan-001`) và quy tắc "người dùng chốt ngày…" là kinh nghiệm từ các video đã làm. Muốn đổi thì sửa thẳng trong `SKILL.md` hoặc `references/`.
- **Giọng máy:** VieNeu Đoan Trang, temperature 0,1, top_k 10. Lời máy đọc bỏ dấu hỏi (đổi thành dấu chấm), vì dấu hỏi làm máy lên giọng cuối câu kiểu tiếng Anh. Phụ đề vẫn giữ dấu hỏi. Chi tiết ở `references/tts-voice-version.md`.
- **B-roll và SFX:** lấy từ Mixkit (giấy phép Mixkit Free). Font Be Vietnam Pro và Noto Sans KR theo giấy phép OFL.
