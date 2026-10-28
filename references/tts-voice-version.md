# Phiên bản giọng đọc máy (VieNeu-TTS)

Dùng khi người dùng muốn thêm một bản của cùng video đọc bằng giọng máy, ví dụ "thêm một phiên bản dùng VieNeu giọng Bắc". Bản gốc (giọng người thật) vẫn giữ nguyên; bản máy là một video riêng có slug `<slug>-vieneu`.

## Giấy phép và đạo đức

- VieNeu-TTS v3 Turbo ([pnnbao97/VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS), model [pnnbao-ump/VieNeu-TTS-v3-Turbo](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo)): mã nguồn, trọng số và **giọng dựng sẵn** đều Apache-2.0. Model card ghi âm thanh tạo bằng giọng dựng sẵn "được dùng trong nội dung thương mại", và người thu giọng đã đồng ý cho tổng hợp giọng. Khi đăng, giữ ghi công dự án.
- v4 là bản độc quyền (chỉ qua API vieneu.io), không dùng trong skill.
- **Không nhân bản giọng người thật** (người nói trong footage) khi chưa có đồng ý bằng văn bản của họ. Mặc định dùng giọng dựng sẵn.

## Giọng Bắc dựng sẵn

Minh Đức, Phạm Tuyên, Xuân Vĩnh, Thanh Bình, Ngọc Linh, Đoan Trang, Quỳnh Anh, Quốc Tuấn.

Đo trên câu hook clip-12 (whisper khớp kịch bản; F0 là cao độ trung vị):

| Giọng | Khớp | F0 | Chữ/giây |
|---|---|---|---|
| Ngọc Linh (mặc định clip-12) | 0,96 | 203 Hz | 4,3 |
| Quỳnh Anh | 0,96 | 222 Hz | 4,1 |
| Đoan Trang | 0,96 | 235 Hz | 4,3 |
| Minh Đức | 0,96 | 157 Hz | 3,7 |
| Quốc Tuấn | 0,96 | 160 Hz | 4,8 |
| Thanh Bình | 0,93 ("du" thành "dù") | 160 Hz | 4,7 |
| Phạm Tuyên, Xuân Vĩnh | 0,96 | 110 Hz | 4,3–4,4 |

0,96 là trần, vì whisper ghi "2" thay cho "hai". Nếu người dùng không chỉ giọng: chọn giọng gần người nói gốc (cao độ, tốc độ), đọc thử câu hook bằng 3–8 giọng, đưa file mẫu cho người dùng nghe để đổi.

**Kênh du học Hàn cá nhân (nhân vật Linh): mặc định Đoan Trang, đọc nguyên bản** (người dùng chọn sau khi so hai bản video 004, 21/10/2026; Ngọc Linh là phương án dự phòng). Ngày 21/10/2026 người dùng nghe hai bản Ngọc Linh đọc trọn kịch bản video 004 (không lọc, không tăng tốc, không chọn theo ngữ điệu) và duyệt. Trước đó (19/10/2026, clip-13) người dùng từng bỏ Ngọc Linh vì nghe "lơ lớ", và video 004 giọng Đoan Trang cũng bị chê "lai lái tây". Cả hai lần, giọng TTS đều đi qua chuỗi lọc micro của `prepare-talking-footage.py` (afftdn 20 dB, nén, EQ), rồi còn chọn lần đọc ngữ điệu rộng nhất và tăng tốc ×1,1. Nhiều khả năng nguyên nhân nằm ở phần xử lý đó, không phải ở giọng.

## Kịch bản

- **Phiên âm.** Khi chép lời đã duyệt sang `lines` của script json, viết lại cách đọc cho các từ thuộc một trong các điều kiện sau (người dùng chốt 21/10/2026: "nêu điều kiện cần phiên âm là ok"):
  1. Từ không phải tiếng Việt: tên riêng nước ngoài (địa danh, trường, thương hiệu, tên báo), từ tiếng Anh hay tiếng Hàn viết bằng chữ Latin. Ví dụ Pyeongtaek, HiKorea, one-room, Chuseok.
  2. Chữ viết tắt và mã: TOPIK, KIIP, ARC, D-4, E-7.
  3. Số và ký hiệu máy dễ đọc sai: số có dấu ngăn nghìn (10.320), số thập phân, phần trăm, khoảng số (12-20), ngày (11/5), đơn vị có gạch chéo (won/giờ).

  Không cần phiên âm các chữ trong bảng "Chữ để nguyên" bên dưới.

  Cách viết lại:
  - Theo cách người Việt nói quen, viết bằng âm tiết tiếng Việt có dấu, có thể nối bằng gạch: "Tô-pích", "Đê bốn", "mười nghìn ba trăm hai mươi".
  - Tên chưa có cách đọc quen thì đọc theo âm gốc gần nhất.
  - **Chữ lần đầu gặp: chốt bằng file thử, người dùng nghe tai** (người dùng duyệt video 007, 22/10/2026). Cách làm:
    1. Viết 4–6 cách đọc. Luôn có một cách **để nguyên chữ gốc**: "Seoul" để nguyên mới là cách đúng, sau khi Sê-un, Xơ-un, Xơ-ún, Xê-ul… đều hỏng.
    2. Đọc mỗi cách một lần ở temperature 0,1, đặt trong đúng câu của bài. Lấy cả câu khó nhất, ví dụ câu có chữ đó đứng trước "giá bao nhiêu".
    3. Ghép thành một file, kèm bảng mốc giây, để người dùng nghe chọn. Ghi cách đã chọn vào bảng dưới.
  - **Không tin whisper khi chọn cách đọc chữ lạ.** Whisper chép "Seoul" trong khi tai người nghe "xơ ùn". Nó cũng tự sửa "Sê-un" thành "Seoul". Thước đo cao độ cũng không tách được lần đúng với lần sai. Ở 0,1 mọi lần đọc gần như giống nhau, nên đọc thêm nhiều lần không cứu được cách viết sai.
  - Ngọc Linh đọc "VnExpress" sai, viết "Vi en Express" thì đúng.
  - Tên nước ngoài đứng ngay trước dấu phẩy hoặc dấu chấm bị máy hạ giọng cuối cụm: "ở Seoul," nghe thành "ở Xe ùn" (Đoan Trang, 21/10/2026). Không đặt dấu phẩy hay dấu chấm ngay sau tên nước ngoài trong câu đọc; phụ đề không đổi. Chỗ bắt buộc ngắt thì đặt khoảng nghỉ bằng `pauses`, hoặc chuyển dấu phẩy sang sau chữ kế tiếp.
  - Ghi các từ đã đổi vào `note` của script json.
  - Phụ đề vẫn hiện chữ gốc, sửa bằng `phraseFixes` nếu whisper chép theo cách đọc.

- **Chữ để nguyên, không phiên âm.** Ghi đúng chữ gốc vào `lines`, máy đọc đúng hơn mọi cách viết lại. Chữ mới chỉ được thêm vào bảng này sau khi người dùng nghe file thử và chọn "để nguyên".

  | Chữ | Ghi chú |
  |---|---|
  | Seoul | Người dùng chọn 22/10/2026, temperature 0,1. Các cách viết lại đều bị nghe "Se ùn"/"Xơ ùn"/"xơ ún": Sê-un, Xơ-un, Sơ-un, Xê-un, Xê-ul, Sê-ul, Xơ-ún |
  | Pyeongtaek | Đã thử 9 cách phiên âm, không cách nào tốt hơn; máy đọc gần "Pi-ông-thếch" |
  | Korea | whisper nghe đúng 2/2 |
  | online | whisper nghe đúng 2/2 |
  | visa, video, sim | đã Việt hóa quen tai |

  Chữ **không** được để nguyên dù trông quen: "won" (đọc "uôn"), "TOPIK" (máy đánh vần T-O-P-I-K), "D-4" (đọc "Đê bốn"). Các chữ này nằm ở bảng phiên âm dưới.

`./scripts/data/<slug>-vieneu-script.json`:

```json
{"voice": "Đoan Trang", "pauseSec": 0.28, "lines": ["câu 1", "câu 2"]}
```

- Lời lấy **nguyên văn từ phụ đề cuối của bản gốc**: giữ nghĩa, giữ thứ tự, bỏ chữ vấp.
- Viết lại cách đọc trong `lines`, còn chữ chuẩn để hiện phụ đề để trong `show` (cùng file, nguyên văn kịch bản đã duyệt) và đặt `"captions": {"script": "./scripts/data/<slug>-script.json"}` trong `./scripts/edits/<slug>.json` (`edit-workflow.md`). Phụ đề lấy chữ của `show`, chỉ lấy mốc từ whisper, nên các dòng `fixes`/`phraseFixes` kiểu bảng dưới không cần nữa. Video cũ chưa có `show` vẫn sửa bằng `fixes`/`phraseFixes`. Bảng cách viết cho máy đọc:

  | Chữ chuẩn | Viết cho TTS |
  |---|---|
  | LETCO | Lét-cô |
  | Daeduk | Đê Đắc (như người nói phát âm) |
  | 40% | bốn mươi phần trăm |
  | 2–2,5 triệu | hai đến hai phẩy năm triệu |
  | E7 | E bảy |
  | TOPIK 2 | Tô-pích hai |
  | 3/2027 | tháng ba năm hai nghìn không trăm hai mươi bảy |
  | TOPIK, TOPIK II | Tô pích, Tô pích hai (để chữ Latin "TOPIK" thì máy đánh vần T-O-P-I-K; "Tô-pích" có gạch nối dễ ra "tố pick") |
  | D-2, D-4 | Đê hai, Đê bốn (whisper chép "D2/D4", sửa phụ đề về D-2/D-4) |
  | IIG | I I G (whisper chép "EEG", tai người nghe "i-i-gờ"; "ai ai gi" ra "AI") |
  | won | **uôn** ở temperature 0,1 (người dùng nghe 6 cách, chọn 22/10/2026; để nguyên "won" thì nghe không ổn) |
  | Daejeon | Đê-chơn (video 007, người dùng duyệt 22/10/2026; whisper chép "Đê Trơn" nhưng tai nghe đúng) |
  | bibimbap | bi-bim-báp (video 007) |
  | kimchi jjigae | kim chi chi-ghê (video 007) |
  | kimbap | kim-báp (video 007) |
  | naengmyeon | neng-miơn (video 007; whisper chép "nanh mi ơn") |
  | kimchi (món ăn nói chung) | kim chi (viết như tiếng Việt) |
  | 530.000 won, 12.000 won | năm trăm ba mươi nghìn uôn, mười hai nghìn uôn |
  | 10,6 triệu đồng | mười phẩy sáu triệu đồng |
  | tháng 9, ngày 19/10 | tháng chín, ngày mười chín tháng mười |
  | bưu điện | whisper hay ghi "biêu điện"/"đu điện" dù đọc đúng; sửa phụ đề bằng `fixes`, ghi giây vào báo cáo để người dùng nghe |
  | 2026 (năm) | năm hai không hai sáu (cách người Bắc nói thường ngày, ngắn hơn "hai nghìn không trăm…") |
  | 11.800, 770 nghìn | mười một nghìn tám trăm, bảy trăm bảy mươi nghìn |

- **Mỗi dòng `lines` là một câu trọn, giữ dấu phẩy ở chỗ người thật ngắt hơi** (người dùng nghe A/B truong-007 ngày 22/10/2026 và chọn bản "giữ dấu phẩy": `du-lieu/video-xuat/nghe-thu-giong/truong-007-cau-tron-A-co-dau-phay.mp3`, so với bản bỏ hết dấu phẩy và bản cắt câu thành mảnh). Không cắt câu thành nhiều dòng ở chỗ phẩy: máy đọc từng mảnh rời không biết câu đang lên hay xuống. Quy tắc cũ "không dấu phẩy, tách dòng + pauses 0,15 s" (sáng 22/10/2026) là lúc còn `temperature` 0,8; với 0,3/10 dấu phẩy không làm lơ lớ. Dấu hai chấm thì tách thành hai câu, ngoặc kép đổi thành dấu phẩy. Phụ đề lấy từ `show` nên vẫn giữ đủ dấu. Mẫu: `scripts/data/truong-007-cau-a-script.json`.
- **Bỏ dấu hỏi trong `lines`** (chốt 26/10/2026, thay quy tắc "giữ dấu hỏi" của 22/10): gặp "?" VieNeu lên giọng cuối câu theo kiểu tiếng Anh, chữ cuối méo thanh, nghe lơ lớ (người dùng chỉ ra chữ "thế?" của tinhan-001: có "?" lên +3,0 nửa cung, đổi "." hạ −2,6). Tiếng Việt hỏi bằng chữ ("thế", "không", "chưa"), không bằng giọng. Trong `lines` đổi "?" cuối câu thành ".", "?" giữa dòng thành ","; `show` (phụ đề) vẫn giữ "?". File nghe: `du-lieu/video-xuat/nghe-thu-giong/cau-hoi-dau-hoi-va-dau-cham.mp3`.
- **Điểm whisper thấp = thường là lơ lớ** (người dùng nghe 12 cặp 22/10/2026: lần bị chấm thấp nào cũng lơ lớ, lần được chọn đều "rất mượt"). Máy đọc lơ lớ thì whisper nghe ra chữ khác, nên `tts-pick.py` đọc thêm mọi câu whisper nghe lệch dù một chữ (`ACCEPT` 0,999). Nghe trực tiếp vẫn cần cho kiểu lơ lớ không làm lệch chữ.
- Đọc thêm khi cần (22/10/2026): 148 câu của 7 bài cũ, lần đọc đầu sai chữ thật ở 12 câu (khớp 0,75–0,89: "10 triệu" thành "40 triệu", "Trường bạn nhắm" thành "Chương bạn nhóm"); khớp 0,9–0,95 phần lớn là whisper nghe nhầm tên riêng ("D4", "Pyeongtaek"). Đọc 3 lần mọi câu tốn gấp ~3 lần VieNeu và whisper mà lần 1 đã đúng ở ~90 % câu. Điểm từng lần lưu ở `<takes>/scores.json`.
- `tts-pick.py` đo độ lên giọng 0,3 s cuối mỗi lần đọc ("cuối câu ±x" trong log). Trong các lần khớp chữ ngang nhau (lệch ≤ 0,05), câu có chữ cuối thanh ngang/huyền/nặng lấy lần không lên giọng quá 1,5 nửa cung. Chữ cuối thanh sắc/hỏi/ngã lên giọng là đúng thanh, không phạt.
- Mỗi câu một dòng. Câu dài trên 25 chữ thì tách thành hai dòng ở chỗ ngắt tự nhiên, vì VieNeu dễ "nói thêm" ở chunk dài (thư viện có sẵn `babble_retries`).
- Thử trước các chữ lạ (tên riêng, viết tắt, chữ nước ngoài) bằng 1–2 lần đọc mỗi cách viết rồi cho whisper nghe; chọn cách whisper nghe ra đúng ở mọi lần.
- Số đọc thành chữ làm bài dài hơn chữ viết khoảng 15–20 % (topik-003: 547 chữ đọc so với 464 chữ viết). Ước thời lượng theo bản đọc, không theo bản viết.

## Video giọng đọc từ kịch bản (không có bản gốc quay thật)

Dùng cho kênh không lộ mặt (kho voice over du học Hàn): lời lấy nguyên văn từ kịch bản người dùng đã duyệt, chỉ viết lại cách đọc như bảng trên.

```bash
# 1. đọc 1 lần mỗi câu, whisper chấm chữ + đo lên giọng cuối câu; chỉ câu whisper nghe lệch dù một chữ hoặc lên giọng sai thanh mới đọc thêm 2 lần
#    rồi chọn; ghép giọng + nguồn giả + file nghe du-lieu/video-xuat/nghe-thu-giong/<slug>-giong.mp3 và mốc câu out/tts/<slug>-lines.txt
uv run ./scripts/tts-build.py <slug> <ảnh-nền.jpg>
# 2. GỬI NGƯỜI DÙNG NGHE file giọng (kèm bảng mốc câu) và chờ trả lời TRƯỚC khi chép lời/dựng timeline. Whisper chỉ bắt lơ lớ khi nó làm
#    lệch chữ; trong lúc chờ chỉ làm việc không phụ thuộc thời gian giọng (dò B-roll, style, bìa).
#    Câu bị chê: đọc thêm `tts-takes.py … --takes 5 --only <câu>` rồi chạy lại tts-pick (lần đọc cũ không chấm lại), hoặc force.
# 3. sửa lựa chọn (force/tempo/pauses) rồi ghép lại không chấm lại
uv run -p .venv-align python -X utf8 -I ./scripts/tts-pick.py ./scripts/data/<slug>-script.json out/tts/<slug>-takes <slug> --bg <ảnh-nền.jpg> --from-picks
uv run <skill>/scripts/new-video.py . out/tts/<slug>-source.mov <slug> <style>
```

Trường thêm trong `<slug>-script.json`:

- `"pauses": {"<câu>": giây}`: nghỉ sau câu đó. 0,45 s trước câu kéo lại người xem và trước CTA. `build-talking-edit.py` vẫn rút khoảng nghỉ dài (127,8 → 107,7 s thoại ở topik-003).
- `"force": {"6": "06-3.wav"}`: chọn tay. Điểm whisper hòa nhau thì bản đứng trước được chọn dù nghe sai thanh ("Đê hai" thành "đề 2"); đọc các dòng in ra và chọn tay bản đúng.
- `tts-pick.py` luôn in tốc độ từng câu (chữ/giây trên phần có tiếng) so với trung vị của bài, và đánh dấu câu lệch quá 15 % (câu ≥ 8 chữ). Đo 4 bài (tien-019, canh-009, topik-003, truong-018): trung vị 4,3–4,7 chữ/s; câu nhanh bất thường khoảng 1,2 lần trung vị, thường là câu ngắn 9–12 chữ. Tốc độ lưu trong `picks.json` (`pace`, `words`).
- `"paceMax"`: mặc định 1,12 (người dùng chọn bật mặc định 21/10/2026); `0` thì tắt, chỉ báo. Câu nhanh hơn `paceMax` lần trung vị được hãm bằng atempo cho bằng mức đó (chậm nhất ×0,85, bỏ qua mức hãm nhẹ hơn ×0,98), nhân với `tempo`/`emph` của câu. Câu CHẬM không được tăng tốc riêng: nghe lại, chọn lần đọc khác bằng `force`. Cách đo và hãm lấy từ `tools/pacing.py` của claude-code-video-toolkit. Ghép lại video làm trước ngày này bằng `--from-picks` thì giọng đổi ở câu nhanh (tien-019: câu 25 ×0,92, câu 28 ×0,96, dài thêm 0,3 s); muốn giữ nguyên bản đã duyệt thì đặt `"paceMax": 0`.
- `"tempo"`: mặc định không đặt (1,0). Người dùng duyệt bản không tăng tốc (21/10/2026); chỉ tăng tốc khi người dùng yêu cầu, và không vượt 1,1.

- `"emph": {"<câu>": {"tempo": 1.02, "gain": 2}}`: mặc định không dùng (bản người dùng duyệt 21/10/2026 không có). Nhấn nhá bằng khoảng nghỉ `pauses` và thẻ âm thanh. Cách cũ: nhấn câu chốt. VieNeu v3 Turbo không có tham số nhấn nhá (tham số `style` đã bỏ, luôn đọc "tự nhiên"; thẻ cảm xúc chỉ có ở v4 trả phí), nên câu chốt được đọc chậm hơn tempo chung và to hơn vài dB khi ghép. Dùng cho 3–6 câu mỗi bài: hook (tempo 1,05, +1,5 dB), câu kết luận, con số người xem phải nhớ. Người dùng hỏi "đã có thêm nhấn nhá vào giọng nói chưa" (21/10/2026).
- Thẻ âm thanh trong câu (VieNeu v3 Turbo, thử nghiệm, theo model card): `[cười]`, `[thở dài]`, `[hắng giọng]`. Thử 21/10/2026: `[hắng giọng]` ra ~0,85 s tiếng hắng trước câu, `[thở dài]` ~1 s (whisper nghe thành "Ha!"), `[cười]` cuối câu thêm ~1,4 s. `[hừm]` KHÔNG có: máy đọc thành "Hương/Hưng". Muốn "hừm" thì viết thẳng chữ "Hừm," đầu câu (whisper nghe đúng 2/2; "Ừm," bị nuốt 1/2). Dùng thưa (1–3 chỗ mỗi bài) ở chỗ người thật cũng phát ra: thở dài trước tin xấu, cười sau chuyện tự giễu; không đặt ở hook vì làm chậm câu mở. `tts-pick.py` bỏ phần trong `[...]` khi chấm. Phụ đề: whisper có thể chép tiếng thở thành "Ha!", xóa bằng `phraseFixes`. Người dùng đề xuất "có thêm humm ehem mà… có trong v3 turbo".
- Thông số lấy mẫu của `infer` (v3 Turbo, mặc định `temperature` 0,8, `top_k` 25, `repetition_penalty` 1,2). Thử 22/10/2026: `repetition_penalty` 1,0 làm máy đọc lặp ("Trường bạn nhắm mọi người cũng biết"), mất dấu ("Minh con"), dài gần gấp đôi, nên giữ 1,2. `temperature` 0,5 và 0,3 (`top_k` 10) whisper nghe đủ lời; mẫu nghe so sánh ở `~/work/backend/video_creater/du-lieu/video-xuat/nghe-thu-giong/so-sanh-giong-tts/`. Người dùng nghe và chọn `temperature` 0,3 + `top_k` 10 ("ngon", hết lơ lớ; mặc định 0,8 nghe lơ lớ). Chốt tối 22/10/2026: **kênh Linh dùng `temperature` 0,1 + `top_k` 10, là mặc định của `tts-takes.py`.** Diễn biến trong ngày:
  - Sáng chọn 0,3 / 10 vì đỡ lơ lớ.
  - Tối đổi sang 0,8 vì ở 0,3 Seoul kẹt "Se ùn" ở mọi lần đọc.
  - Rồi người dùng nói "ko cho vieneu sáng tác nhiều" và chọn 0,1.

  Ở 0,1 mọi lần đọc gần như giống hệt nhau, nên chữ khó **không chọn bằng cách đọc nhiều lần**. Làm thế này:
  1. Làm file thử: mỗi cách viết đọc 1 lần trong đúng câu của bài.
  2. Người dùng nghe bằng tai và chọn.
  3. Ghi cách viết đã chọn vào bảng trên.

  Đổi mức lấy mẫu là phải đọc lại cả bài, vì trộn câu 0,1 với 0,8 thì giọng không đều. Dòng `"sampling"` trong `<slug>-script.json` chỉ đặt khi cần ghi đè.
- Không chọn theo ngữ điệu nữa. `tts-pick.py` chỉ chọn lần đọc khớp chữ nhất; nếu hòa điểm thì lấy lần đầu tiên. Cột "ngữ điệu … nửa cung" trong log chỉ để tham khảo. Trước đây script lấy lần có khoảng cao độ rộng nhất (EXPR_SLACK 0,03), nhưng với tiếng Việt có thanh điệu, ngữ điệu quá rộng nghe lơ lớ như người nước ngoài nói (video 004, 21/10/2026).
- Giọng máy không bị rút khoảng nghỉ. Khi có `out/tts/<slug>-voice.wav`, `build-talking-edit.py` chỉ rút khoảng lặng dài hơn 1,0 s, còn lại 0,45 s; clip quay người thật vẫn rút khoảng lặng dài hơn 0,28 s, còn lại 0,1 s. Cách cũ rút cả chỗ ngắt ở dấu phẩy (video 004: 25 nhát cắt, 18 nhát giữa câu, giọng 73 s còn 64 s), làm giọng liền một hơi và nghe lơ lớ, dù giọng thô nghe ổn (21/10/2026). Muốn đổi thì đặt `maxPause`/`keepPause` trong `./scripts/edits/<slug>.json`.
- Giọng máy không đi qua chuỗi lọc micro. Khi có `out/tts/<slug>-voice.wav`, `prepare-talking-footage.py` chép nguyên file đó, không chạy afftdn, nén hay EQ.

- Ngọc Linh đọc sai "VnExpress" cả 6/6 lần (whisper nghe thành "VGF", "Vinh Express"). Viết thành "Vi en Express" thì 3/3 lần đúng (21/10/2026). Kiểm câu đã sửa cách viết bằng whisper trên cả câu, không chỉ nhìn phần đầu: cách viết "Vi en Ếch-prét" từng làm máy đọc cụt, mất nửa sau câu.
- Whisper chép lời cả bài (`transcribe-source.py`) có thể nghe sai chữ mà whisper chấm từng câu nghe đúng ("lịch sự" thành "địch sự", "nên" thành "nền"). Đối chiếu với log chấm câu, đúng thì chỉ sửa phụ đề bằng `phraseFixes`, không cần đọc lại.

Điểm thấp ở bảng chấm thường chỉ do đổi chữ (Tô pích → "Topic", Đê bốn → "D4"): đọc dòng whisper nghe được, không chỉ nhìn điểm.

Phụ đề: whisper chép theo ngữ cảnh cả bài nên vài chữ nghe đúng khi tách riêng lại sai trong bản ghép ("phải" → "vài", "khi" → "thi"). Kiểm mép cắt bằng `check-cut-edges.py`; mép sạch thì là lỗi chép, sửa bằng `phraseFixes` và ghi giây vào báo cáo để người dùng nghe. `phraseFixes` chỉ sửa lần xuất hiện đầu tiên sau mốc giây: chữ lặp nhiều lần (D 2, D 4) cần một dòng cho mỗi lần, kèm giây tìm từ (`["D 2", "D-2", 66]`).

## Lệnh

```bash
uv run ./scripts/tts-voiceover.py <slug>-vieneu "Ngọc Linh" public/footage/<slug>-last-frame.jpg
uv run <skill>/scripts/new-video.py . out/tts/<slug>-vieneu-source.mov <slug>-vieneu <style-của-bản-gốc>
```

- Lần đầu `tts-voiceover.py` tạo `.venv-vieneu` với `vieneu==3.8.3` và `onnxruntime==1.22.1`. Bản onnxruntime 1.23+ (đã thử 1.31) báo "External data path escapes model directory" vì cache Hugging Face dùng symlink sang `blobs/`. Script cũng tải backbone thành file thật vào `.bin/vieneu-v3-turbo` và chạy `onnx_dir`.
- Tốc độ trên CPU (fp32): clip-12 đo khoảng 10 s tính toán cho mỗi giây âm (13 phút cho 63 s âm); topik-003 (10/2026, máy không bận render) đo khoảng 1 s cho mỗi giây âm. Chạy nền. Bản int8 nhanh khoảng 3 lần nhưng cần CPU có VNNI, nếu không sẽ méo tiếng.
- `new-video.py` coi file "nguồn" giả (ảnh nền tĩnh cộng giọng) như một clip thường: chép lời, EDL, phụ đề, composition. Ảnh nền chỉ hiện mờ ở nền màn kết, nên dùng `-last-frame.jpg` của bản gốc. Footage người nói không bao giờ hiện.
- Đặt `"vadThresholdDb": -40`: giọng TTS sạch tuyệt đối, khoảng nghỉ là im lặng thật, ngưỡng −30 dễ lẹm phụ âm yếu.

## File video `<slug>-vieneu`

- Sao từ file video bản gốc, import overlays của bản gốc (`../<slug>/overlays`), đổi tên hằng.
- **Không có nhịp `talk`**: giọng máy không khớp khẩu hình người nói. Thay mỗi cảnh người nói bằng B-roll đúng nghĩa câu (hook: Hàn Quốc; giới thiệu: lên đường du học; CTA: du học sinh, điện thoại liên hệ).
- Bản này chỉ có một đoạn `body`, nên `cue('intro')`, `cue('cta')`, `cue('scholar')`… của bản gốc phải đổi sang `f('<cụm>')`.
- Dùng chung style với bản gốc. `check-style-novelty.py` coi `<gốc>-<hậu tố>` là phiên bản và cho phép.
- Giọng máy chậm hơn người thật (clip-12: 55 s thoại so với 45 s), nên cảnh dài ra. Đọc cảnh báo "B-roll > 5 s" của cổng style: đồ họa toàn khung có chuyển động (boarding pass) thì chấp nhận; B-roll đứng yên thì tách cảnh.
- Chạy đủ QA như bản gốc. `face-check.py` sẽ báo "không khung nào thấy mặt người nói", và đó là đúng.
