# Âm thanh giọng: đo ồn, khử ồn, ngưỡng dò tiếng, SFX che chữ

Người xem nghe nền "xào xạc" trước cả khi để ý hình. Giọng sạch quyết định video có xem được hay không, nên đo trước khi dựng EDL, không đợi bản final.

## 1. Đo ngay sau new-video.py

```bash
uv run --with numpy python <project>/scripts/measure-voice-noise.py <slug>
```

In mức giọng, mức nền, độ chênh và phổ nền theo dải:

| Chênh giọng − nền | Nghe thế nào | Làm gì |
|---|---|---|
| ≥ 15 dB | Nền chìm dưới nhạc 0,07 | Giữ afftdn của `prepare-talking-footage.py` |
| 10–15 dB | Nghe được ở chỗ nghỉ | `denoise-voice.py <slug> <nguồn> 24` |
| < 10 dB | "Xào xạc", gió ù suốt video | `denoise-voice.py <slug> <nguồn>` (khử hết) |

Phổ nền cho biết loại ồn. Gió/lá cây có năng lượng ở 150–1500 Hz, trùng dải giọng nên afftdn (trừ phổ) không tách được. Quạt/điều hòa nằm dưới 300 Hz, highpass xử lý được. Xì nằm trên 4 kHz.

Ví dụ thật: clip quay ngoài trời dưới tán cây (LETCO clip-12, 10/2026). Sau afftdn, nền −22,4 dB, giọng −19,8 dB, chênh chỉ 2,7 dB, người dùng phản hồi "âm thanh nền xào xạc lắm". Sau DeepFilterNet nền còn −44 dB, chênh 23,7 dB, người dùng nghe A/B và xác nhận "ngon".

## 2. Khử ồn bằng DeepFilterNet

```bash
uv run <project>/scripts/denoise-voice.py <slug> <file-nguồn> [giới-hạn-dB]
```

- Lần đầu tải file chạy Rust chính thức `deep-filter` 0.5.6 (khoảng 36 MB, ghim SHA-256) vào `.bin/`; không cần torch. Kết quả trùng bản Python (`pip install deepfilternet`, cần torch 2.1.2 + numpy < 2, khoảng 200 MB) tới từng dB nền/giọng.
- **Luôn chạy với `-D`** (bù trễ STFT + lookahead): thiếu cờ này giọng trễ 30 ms so với hình, làm lệch khẩu hình và lệch mép cắt (đo bằng tương quan đường bao trên clip-12).
- Chuỗi: `adeclip,highpass=85` → DeepFilterNet3 (48 kHz) → nén/EQ giống `prepare-talking-footage.py` (bỏ afftdn). Không chạy DeepFilterNet trên giọng đã qua afftdn: lỗi phổ của afftdn sẽ bị khuếch đại.
- Bản cũ được giữ ở `<slug>-voice-afftdn.wav`; script tự đặt `"vadThresholdDb": -40` trong `./scripts/edits/<slug>.json`.
- Luôn làm file A/B (6 s bản cũ, 0,6 s lặng, 6 s bản mới) cho người dùng nghe trước khi dựng lại cả video.

Giới hạn giảm (`-a` / `--atten-lim-db`):

| Mức | Nền | Phụ âm xát "ch" (đo trên clip-12) | Dùng khi |
|---|---|---|---|
| khử hết | −45 dB | −52 dB | Gió mạnh, người dùng muốn nền sạch |
| 24 dB | −36 dB | −40 dB | Ồn vừa, ưu tiên giữ phụ âm tự nhiên |

Phụ âm xát/bật hơi yếu (ch, s, x, th, ph) đầu câu bị gió nhấn chìm trong file gốc, nên khử ồn mức nào cũng làm chúng yếu đi. Có nhạc nền thì whisper nghe "Chưa hết" thành "Dù hết"; người nghe có ngữ cảnh thường vẫn hiểu. Sửa phụ đề bằng `phraseFixes` và ghi vào báo cáo để người dùng nghe lại chỗ đó.

## 3. Sau khi đổi track giọng: dựng lại mọi thứ

Khử ồn làm lộ các khoảng nghỉ thật mà trước đây tiếng gió lấp mất. `build-talking-edit.py` vì vậy cắt nhiều jump cut hơn (clip-12 từ 9 lên 16 đoạn, thoại từ 47,9 s xuống 45,3 s). Phải chạy lại theo thứ tự:

1. `build-talking-edit.py`
2. `check-cut-edges.py`
3. `verify-edit-voice.py`
4. `find-voice-leaks.py --write`
5. `caption-talking-edit.py`: mốc giây trong `phraseFixes` lệch theo timeline mới, nên sửa theo cảnh báo "không thấy cụm".
6. Duyệt ảnh lại (nhịp B-roll neo theo cụm từ nên tự dời theo; vẫn phải xem lại).
7. Render.

Trong chuỗi lệnh chạy nền, nối render → master → verify bằng `&&`. Nếu render lỗi (ví dụ thiếu cụm `at` trong phụ đề) mà vẫn chạy master, master sẽ xử lý lại file render cũ, `verify-final` báo đạt trên bản cũ và người dùng nhận một bản chưa sửa.

## 4. Ngưỡng dò tiếng nói (`vadThresholdDb`)

`voice_activity.py` coi khung 10 ms trên ngưỡng là có tiếng. Ngưỡng mặc định −30 dB chỉnh cho nền afftdn khoảng −34 dB. Với giọng đã khử ồn (nền khoảng −45), phụ âm yếu (khoảng −35) nằm dưới −30 nên bị coi là im lặng, và mọi jump cut đều lẹm đầu/đuôi chữ.

Khai ngưỡng theo từng video trong `./scripts/edits/<slug>.json`:

```json
"vadThresholdDb": -40
```

`build-talking-edit.py`, `check-cut-edges.py` và `find-voice-leaks.py` đọc giá trị này qua `voice_activity.configure_for(slug)`; không khai thì giữ −30. Nên đặt ngưỡng thấp hơn nền đo được khoảng 5–10 dB phía trên (nền −45 → ngưỡng −40).

## 5. Mép cắt và chữ lặp

- **Mốc ra cắt cụt đuôi chữ:** chữ cuối câu thường kéo dài sau mốc whisper. Ví dụ "vấn" có mốc 20,84 nhưng thực tế kéo tới 21,08, nên mốc ra 21,00 làm whisper nghe "thương vời". Đo năng lượng 10–30 ms sau mốc, đặt mốc ra sau chỗ năng lượng tụt về nền.
- **Bỏ chữ lặp liền nhau ("tư tư vấn"):** `find-voice-leaks` không bắt vì whisper chép thường cũng ghi đủ hai chữ. Cách làm:
  1. Đo năng lượng 20 ms để tìm các chỗ trũng giữa âm tiết.
  2. Cắt thử 4–5 phương án trên mảng âm nguồn.
  3. Cho whisper nghe mỗi phương án trên **cả câu bắt đầu ở đầu câu** (khúc 2–3 s bắt đầu giữa câu thì whisper bịa "Hãy subscribe…") và **không đưa gợi ý chứa lời đúng** (gợi ý làm whisper "sửa" lời nên phương án nào cũng ra đúng).
  4. Chọn phương án mà cả lượt chép thường lẫn lượt nguyên văn đều ra đúng, rồi dựng thật và nghe lại `edit-voice.wav`: mép bắt theo sóng âm có thể lệch so với phép cắt thử thô.

## 6. SFX che chữ

Khi chữ nghe sai ở bản final mà bản ghép giọng nghe đúng, khoanh vùng theo lớp thay vì đoán:

1. Nghe `public/footage/<slug>-edit-voice.wav` cùng khúc: sai ở đây là lỗi mép cắt hoặc khử ồn, không phải do trộn.
2. Render riêng track SFX của khúc đó: `npx remotion render ... --frames=a-b --props='{"stem":"sfx"}'`, đo RMS 50 ms để biết tiếng nào đang kêu đúng lúc chữ được nói.
3. Nghe bản trước master (`out/<slug>.mp4`) để tách lỗi do master.

Các trường hợp đã gặp:

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| "học bổng" thành "họng bổng" dù hit đã dời vào khoảng nghỉ | `achievement` dài 2,4 s, kéo tới tận chữ | Dùng tiếng ngắn (`bass-hit` 1,1 s) hoặc bỏ hẳn. Xem độ dài: `ffprobe public/sfx-norm/<tên>.mp3` |
| "Ký hợp đồng" thành "Chính hợp đồng": whoosh canh đỉnh (phát sớm tới 0,6 s) nối liền tiếng `signing` 2,2 s, SFX −20…−28 dB suốt câu | Hai tiếng liên tục đè cả câu, ducking 0,6 không đủ | `silent: true` cho nhịp đó và bỏ hit; một câu đã có đồ họa nhấn thì không thêm tiếng theo hình |
| "Ký" vẫn sai sau khi đã tắt tiếng chuyển cảnh và hit của cảnh đó | Tiếng của **đồ họa** cảnh trước (dấu VISA `impact-deep`: đỉnh 0,63 s, kéo 1,4 s) bật ở chữ "visa" và rơi đỉnh đúng chữ đầu câu sau | Stem SFX cho thấy −21…−25 dB đúng lúc chữ; cho đồ họa hiện lặng. Xem `peak`/`end` trong `sfx-meta.json` trước khi gắn tiếng dài vào đồ họa sát câu sau |
| Phụ âm đầu câu bị nuốt ("Chưa" thành "Dù") khi cảnh B-roll đổi đúng đầu câu | Whoosh chuyển cảnh nhiều tần cao che phụ âm xát; sau khi cắt sát không còn khoảng nghỉ đệm | `silent: true` trên nhịp B-roll đó (chỉ tắt tiếng chuyển cảnh, hình vẫn chuyển) |
| Đồ họa bật kèm tiếng đúng chữ khóa | `Sfx at={from + 6}` rơi vào chữ đang nói | Cho đồ họa hiện lặng, hoặc đặt tiếng vào khoảng nghỉ trước câu |

Một câu tối đa 2 tiếng hit. Cảnh đã có chuyển cảnh kêu thì đồ họa trong cùng câu nên hiện lặng.
