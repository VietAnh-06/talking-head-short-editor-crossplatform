# Quy trình dựng một video (lệnh và cấu hình)

Chạy trong thư mục project tạo bằng `uv run scripts/new-project.py`. `<slug>` là tên video (chữ thường, gạch nối).

## 1. Khởi tạo video

Một video quay thành nhiều file (C3746, C3753…): ghép theo thứ tự cảnh trước. Script tự xoay theo cờ rotation (máy ảnh quay dọc lưu 1920×1080 kèm rotate 90 nên `ffprobe` báo ngang mà khung thật là dọc) và in ranh giới từng cảnh:

```bash
uv run <skill>/scripts/concat-footage.py <tmp>/<slug>-combined.mov C0001.MP4 C0002.MP4 ...
```

```bash
uv run <skill>/scripts/new-video.py <project> <file-quay.mp4> <slug> [style]
```

Làm: footage 1440×2560@30 có chỉnh màu (`public/footage/<slug>-graded.mp4`), giọng làm sạch (`-voice.wav`: sửa clip, lọc ồn, nén, nhấn 3,4 kHz), khung cuối (`-last-frame.jpg`), bản chép lời có mốc từng từ (`./scripts/data/<slug>-transcript.json`, in ra màn hình), EDL tạm giữ toàn bộ, phụ đề, file `src/videos/<slug>/<slug>-short.tsx`, đăng ký vào `src/videos/registry.tsx`, ghi style vào `.style-ledger`.

Khung cuối của nguồn (`-last-frame.jpg`) là nền màn kết. Nếu cảnh cuối quay nhầm (tường, sàn), thay bằng một khung có người nói: `ffmpeg -ss <giây> -i <nguồn> -frames:v 1 -vf scale=1440:2560 -q:v 2 public/footage/<slug>-last-frame.jpg`.

## 1b. Âm thanh giọng (trước EDL)

```bash
uv run --with numpy python <project>/scripts/measure-voice-noise.py <slug>
uv run <project>/scripts/denoise-voice.py <slug> <file-nguồn> [24]     # khi chênh giọng−nền < 10 dB
```

Chi tiết, ngưỡng và cách khoanh vùng chữ bị che: `voice-audio.md`.

## 2. Đọc và phân tích

- Xem khung: `ffmpeg -i <nguồn> -vf "fps=1/4,scale=270:-2" khung/f%03d.jpg` rồi ghép `magick montage` và đọc ảnh. Nhiều cảnh: xem riêng từng cảnh theo ranh giới `concat-footage.py` in ra. Cảnh máy chĩa nhầm chỗ (chỉ có tiếng): mọi nhịp trong đoạn đó phải là B-roll hoặc đồ họa toàn khung.
- Ảnh ghép lớn (> 400 KB) bị chặn đọc: thu `magick … -resize 1100x -quality 55` trước.
- Bản chép lời thường bỏ tiếng đếm "1, 2, 3, máy chạy" và câu "Được không?" giữa cảnh: chép riêng từng cảnh với gợi ý nguyên văn để thấy chúng, rồi đặt mốc né ra.
- Đọc bản chép lời in ở bước 1; xác định thể loại (`viral-editing-playbook.md`), câu đắt nhất cho cold open, đoạn câu hỏi, các ý, chỗ vấp/lặp/nhịu.

## 3. EDL: `./scripts/edits/<slug>.json`

```json
{
  "transcript": "./scripts/data/<slug>-transcript.json",
  "sections": [
    ["cold", 100.89, 104.55, "câu chốt làm cold open"],
    ["question", 0.59, 7.03, "người nói đọc câu hỏi"],
    ["key", 7.68, 15.43, "ý chính; bỏ 'Chào em'"],
    ["tier1", 19.85, 34.40, "..."]
  ],
  "cues": {"keyLine": ["key", 10.61], "tier1": "tier1"},
  "zoom": {"tight": ["cold"], "wide": ["question"], "push": ["wrap"]},
  "captions": {
    "vocab": "Từ vựng gợi ý cho whisper: tên riêng, thuật ngữ.",
    "fixes": {"giữa": "rửa", "topic": "TOPIK"},
    "dropAtSentenceStart": [],
    "emphasis": ["mức lương", "rửa bát", "TOPIK"]
  }
}
```

- `sections`: `[nhãn, giây bắt đầu, giây kết thúc, ghi chú]` theo **thứ tự trên timeline** (cold open đứng đầu dù lấy từ cuối clip). Có đoạn tên `question` thì có thẻ bình luận (thẻ chỉ hiện trong đúng đoạn này, nên giữ câu hỏi liền một đoạn; bỏ chỗ vấp trong câu hỏi bằng `drop`). Không có thì bỏ qua.
- Mốc lấy từ bản chép lời; script tự bắt vào sóng âm:
  - Mốc rơi vào khoảng lặng: lấy tiếng nói trong [mốc vào, mốc ra], chừa lề nhỏ.
  - Mốc rơi giữa lời nói: cắt ở **ranh giới âm tiết** (chỗ trũng năng lượng, thấp hơn hai bên ≥ 4 dB) kế tiếp phía sau mốc (≤ 0,35 s), không chừa lề. Mốc chữ whisper thường **sớm hơn thật 0,1–0,2 s** ("đây" hết ở 24,68 chứ không phải 24,58), nên mốc hay nằm trong đuôi chữ đứng trước; lùi lề vào lời nói sẽ kéo theo mảnh chữ đó.
  - Mốc ra mà tiếng tắt trong 0,35 s sau mốc: đó là đuôi chữ cuối, giữ hết.
  - Hai đoạn liền nhau trong nguồn (mốc vào = mốc ra đoạn trước): đoạn sau bắt đầu sau phần đoạn trước đã phát, không phát lại ("gia đình… đình").
- `build-talking-edit.py` ghi thêm `public/footage/<slug>-edit-voice.wav`: giọng đã ghép chính xác tới mẫu, fade 12 ms ở mỗi mép cắt; `VoiceTrack` phát file này (phát từng đoạn rời thì bật/tắt tiếng đột ngột ở mép).
- `drop`: `[[giây bắt đầu, giây kết thúc, "ghi chú"], ...]` theo giây nguồn: âm luôn bị cắt ra dù nằm giữa một đoạn (tiếng đệm, chữ lặp, đuôi chữ đoạn bên cạnh). Thường do `find-voice-leaks.py --write` ghi.
- `cues`: tên mốc → `"nhãn"` (đầu đoạn) hoặc `["nhãn", giây nguồn]` (một từ trong đoạn). Dùng trong code bằng `cue('tên')` (khung hình).
- `zoom`: nhãn đoạn phóng sát (`tight`), rộng (`wide`), đẩy dần (`push`).
- `vadThresholdDb` (tùy chọn, mặc định −30): ngưỡng dò tiếng nói cho dựng/kiểm mép/dò âm thừa. Giọng đã khử ồn bằng DeepFilterNet đặt −40 (`denoise-voice.py` tự ghi), nếu không phụ âm yếu bị cắt lẹm ở mọi jump cut.
- Câu được nói hai lần (lần đầu vấp): dùng lần sau làm cả đoạn, không ghép nửa đầu lần 1 với nửa sau lần 2.

```bash
uv run --with numpy python <project>/scripts/build-talking-edit.py <slug>
uv run -p .venv-align python <project>/scripts/verify-edit-voice.py <slug>         # chữ thừa/thiếu ở điểm cắt
uv run --with numpy python <project>/scripts/check-cut-edges.py <slug>        # mép cắt giữa âm tiết, đoạn phát lại (không dùng whisper)
uv run -p .venv-align python <project>/scripts/find-voice-leaks.py <slug> --write   # tiếng đệm, chữ/cụm lặp whisper bỏ qua (~8–12 phút)
uv run --with numpy python <project>/scripts/build-talking-edit.py <slug>     # dựng lại với drop; lặp 2 lệnh trên tới khi không còn "BỎ ĐƯỢC"
uv run -p .venv-align python <project>/scripts/listen-edit.py <slug> 20 30          # nghe nguyên văn một khúc timeline để duyệt
```

Lặp đến khi bản ghép không còn chữ thừa/thiếu. Clip whisper nghe ra câu bịa ("Hẹn gặp lại các bạn...") là clip chỉ có âm thừa: bỏ.

**Vì sao cần `find-voice-leaks.py`:** whisper chép thường "dọn" lời. Nó bỏ tiếng đệm (ừm, ờ, à), gộp chữ lặp ("em, em" thành "em") và kéo một chữ thật phủ lên cả giây tiếng đệm đứng trước, nên bản chép lời và `verify-edit-voice.py` đều không thấy những âm này; người xem thì nghe rõ. Script nghe từng khúc 3–8 s hai lần (thường và nguyên văn), coi tiếng đệm/chữ lặp chỉ có ở bản nguyên văn là âm thừa, xác nhận lại bằng hai cửa sổ lệch tâm, rồi cắt thử và nghe lại để chắc không mất chữ thật. Khúc whisper bịa câu được tách nhỏ và nghe lại; vẫn bịa thì báo "không kiểm được": nghe khúc đó bằng `listen-edit.py` (khúc ngắn 3–5 s, bắt đầu bằng lời thật) và tự thêm `drop`.

- Chạy lại sau mỗi lần dựng tới khi không còn "BỎ ĐƯỢC" (thường 2–3 lượt: bỏ một tiếng đệm làm lộ chữ lặp bên cạnh). Mỗi lượt có bước xác nhận lệch tâm nên không ra báo nhầm ở điểm nối mới.
- Script thiên về giữ: âm whisper không nghe ra lần thứ hai thì để lại (thà sót một tiếng "ừm" còn hơn cắt mất đầu chữ). Duyệt lại các dòng "bỏ qua"/"giữ" đọc như âm thừa thật bằng `listen-edit.py`, đúng thì thêm tay vào `drop`.
- Nghe lại mọi dòng "BỎ ĐƯỢC" là chữ thật lặp lại (không phải tiếng đệm) bằng `listen-edit.py` trên bản đã dựng: whisper đôi khi nghe ra chữ lặp không có thật ("hoài nghi nghi"); nghi thì chép nguyên văn vùng nguồn để đối chiếu.
- Đọc kỹ chữ lặp ở ranh giới câu: hai câu nối nhau cùng một chữ ("…gọi là OIST. OIST là một viện…") không phải nói vấp; script bỏ qua khi giữa hai bản có khoảng lặng ≥ 0,3 s, nhưng vẫn nên đọc. Sai thì xóa khoảng đó khỏi `drop` rồi dựng lại.
- Bộ LETCO 06/2025 (10 video, 3 lượt): bỏ 2–12 chỗ mỗi video ("ừm à ừm", "ờ", "à", "thì thì", "cái cái", "so với, ờ, so với"), lời ngắn đi 1–4 s mỗi video.

## 4. Phụ đề

```bash
uv run -p .venv-align python <project>/scripts/caption-talking-edit.py <slug>
```

Chép lời lại từ track đã cắt theo khúc ~20 s (chữ và mốc khớp đúng cái người xem nghe; chép cả track một lượt thì whisper bịa câu ở 30 s đầu).

Video có kịch bản (giọng máy): đặt `"captions": {"script": "./scripts/data/<slug>-script.json"}` (lấy khóa `show`) hoặc một file `.txt`. Chữ và dấu câu lấy từ kịch bản, whisper chỉ cho mốc: đoạn whisper nghe khác (phiên âm, số đọc thành chữ) nhận chữ kịch bản trải đều trên đúng khoảng đó, nên không cần `fixes`/`phraseFixes` cho các chữ đó. Log báo tỉ lệ khớp (dưới 60 % thì dừng: sai file hoặc sửa kịch bản sau khi đọc), chữ kịch bản bị EDL cắt (`bỏ '…'`), đoạn ngoài thứ tự kịch bản như cold open (mượn chữ câu tương ứng), và chữ whisper không có trong kịch bản (`giữ chữ whisper`, sửa bằng `phraseFixes`). Footage người thật thì không đặt `script`: người nói không đọc đúng kịch bản.

Kiểm tra bản in: sửa chữ sai bằng `fixes` (một chữ) hoặc `phraseFixes` (`[["cụm nghe sai", "cụm đúng", giây tìm từ?]]`, sửa cả chữ lặp/bịa và dấu câu), thêm cụm vào `emphasis`, bỏ âm sót ở đầu câu bằng `dropAtSentenceStart`.

Mọi sửa phụ đề để trong cấu hình, không sửa tay `src/talking/edits/<slug>.json` (lần chạy sau sẽ mất). Khi EDL đổi sau khi đã có phụ đề (thêm `drop`, dời mốc), `build-talking-edit.py` tự dời mốc phụ đề cũ và bỏ chữ rơi vào phần đã cắt, không cần chép lại.

## 5. B-roll và âm thanh

Dò, xem, tải theo `broll-and-sound.md`. Khai báo trong `BEATS` của file video:

```tsx
{atSec: 0, kind: 'broll', clip: 'mixkit-27856', label: 'Hàn Quốc', amb: 'amb-city', ambVolume: 0.14},
{at: 'thưa thầy', kind: 'talk'},
{at: 'rửa bát', kind: 'broll', clip: 'mixkit-46626', label: 'Rửa bát', startSec: 3, hit: 'plates', amb: 'sink-water'},
{at: 'chúng ta có thể miêu tả', after: 30, kind: 'broll', clip: 'mixkit-32101', label: 'Nồi áp suất'},
```

- `at`: cụm từ trong phụ đề (không dấu câu, không phân biệt hoa thường), tìm từ sau nhịp trước; `after` (giây) khi cụm xuất hiện nhiều lần. Không thấy cụm → render báo lỗi kèm tên cụm.
- `startSec`: bỏ phần đầu clip nhạt; `focusX`: tâm cắt ngang (%).
- `hardOut: true`: cắt thẳng sang cảnh người nói kế tiếp, không chuyển cảnh mờ/quét. Bắt buộc cho nhịp B-roll **cuối của một đoạn chỉ có giọng** (máy quay chĩa nhầm chỗ) đứng ngay trước nhịp `talk`: chuyển cảnh để lộ footage phía dưới, mà đó vẫn là đoạn quay nhầm (clip-12: 0,4 s mặt tường trước CTA). Nhịp `talk` đó đặt `{atSec: DATA.cue('<đoạn>') / 30, kind: 'talk'}` cho khớp đúng mốc clip, vì mốc chữ whisper sớm khoảng 0,17 s.
- `silent: true`: tắt tiếng chuyển cảnh của riêng nhịp đó, khi cảnh bật đúng phụ âm đầu câu và whoosh che chữ (`voice-audio.md` §6).
- Cảnh đầu tiên nên là B-roll (cold open) hoặc thầy toàn khung; render tự xử lý để không có khung đen.

## 6. Đồ họa và tiêu đề

Trong `<TalkingShort>` của file video:

```tsx
<Headline from={cue('tier1')} to={cue('tier2')} kicker="Ảnh hưởng #1" text={"Áp lực\nTỐC ĐỘ"} hi={['TỐC', 'ĐỘ']} />
```

Logo thương hiệu/đối tác: để trong `public/img/` (SVG chính thức từ website của họ, ví dụ `ddu.ac.kr/resources/.../logo.svg`, khi người dùng chưa đưa file), đặt trên nền trắng/giấy vì logo màu đậm không đọc được trên nền tối; truyền cả hai vào `endCard.logos`, thêm vào thẻ/đồ họa có tên thương hiệu và một pill logo ở hook/CTA.

Đồ họa riêng (thẻ cấp độ, checklist, đồng hồ áp suất...) viết trong `src/videos/<slug>/overlays.tsx`, đặt ở vùng trên (top 250–600), lấy màu/font từ `useStyle()`, âm thanh bằng `<Sfx at={...} name="..."/>`. Ví dụ thật: thẻ LEVEL kiểu game, checklist 3 bước, đồng hồ áp suất kim vọt vào vùng đỏ, thẻ TOPIK cột mọc dần.

## 7. Duyệt ảnh trước khi render

```bash
npx remotion still src/index.ts <Composition> out/still.jpg --frame=<n> --scale=0.4 --props='{"style":"bold-news"}'
```

Xuất 8–12 khung (cold open, câu hỏi, mỗi ý, chuyển cảnh, màn kết), ghép `magick montage`, đọc ảnh. Soát: chữ mồ côi khi ngắt dòng, đồ họa che mặt, phụ đề lọt vùng giao diện, khung đen ở chuyển cảnh.

## 7b. Still hàng loạt (QA)

```bash
node <project>/scripts/qa-frames.mjs <Composition> out/qa/<slug> --every=15          # full-*.jpg + bare-*.jpg, ~1 s/still
node <project>/scripts/qa-frames.mjs <Composition> out/qa/<slug>-pick --frames=30,240,955 --variant=full --scale=0.4
```

Bundle một lần, giữ một trình duyệt, nên nhanh hơn nhiều lần so với gọi `npx remotion still` từng khung. Bundle nằm ở `out/qa/.bundle` và `public/` được symlink, không chép: `/tmp` là tmpfs trong RAM (16 GB), mỗi bundle chép 13 GB `public/` sẽ lấp đầy nó. `bare` = `--props='{"qa":"bare"}'`: chỉ còn footage người nói và màu, khung B-roll ra đen.

## 8. Render, master, kiểm tra

```bash
npx remotion render src/index.ts <Composition> out/<slug>.mp4 --log=error
uv run <project>/scripts/master-loudness.py out/<slug>.mp4          # → out/final/<slug>.mp4, −14 LUFS
uv run <project>/scripts/verify-final.py out/final/<slug>.mp4       # khung đen, LUFS, whisper nghe lại theo khúc
```

Sau master, QA bản final:

```bash
uv run --with numpy --with pillow python <project>/scripts/cut-strips.py <slug>                              # out/qa/<slug>-cuts-NN.jpg
uv run -p 3.12 --with mediapipe --with pillow --with numpy python <project>/scripts/face-check.py out/qa/<slug>  # cần qa-frames trước
```

`verify-final.py` in độ to cold open / thoại / màn kết và cảnh báo khi lệch. Rồi chạy critic theo `critic-review.md`.

Render 70–90 s mất 4–9 phút (CPU 16 luồng). Chạy nền, nối `render && master && verify && cp` để một bước lỗi dừng cả chuỗi (render lỗi mà vẫn master thì `verify-final` báo đạt trên bản cũ). Máy đang bận (nhiều render/whisper cùng lúc) thì render hay lỗi `delayRender` timeout hoặc compositor bị SIGKILL do hết RAM: thêm `--concurrency=2 --timeout=240000 --offthreadvideo-cache-size-in-bytes=536870912`, và đừng chạy song song nhiều render. Câu "Cảm ơn các bạn đã theo dõi"/"Hãy đăng ký kênh" cuối bản whisper là bịa trên nhạc màn kết, không phải lỗi. Chữ nghe sai ở bản final mà bản ghép giọng nghe đúng: nghe riêng khúc 5–6 s quanh chỗ đó trước khi kết luận SFX che chữ (chép cả bài một lượt whisper hay lệch ngữ cảnh).
