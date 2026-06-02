# Swimlane Activity Diagram

## 1. Process overview
Quy trình mô tả cách các actor phối hợp tiếp nhận tín hiệu, xác minh hiện trường, và xử lý sự cố cháy theo diagram hiện tại. Quy trình được kích hoạt từ Nguồn phát hiện đầu tiên. Bối cảnh đầu vào gồm: 1 trong 4 nhóm phát hiện dấu hiệu cháy. Sau đó Nhân sự vận hành liên lạc (VOC) tiếp nhận và điều phối xử lý ban đầu.

## 2. Business objective
Bảo đảm tín hiệu nghi ngờ cháy được tiếp nhận kịp thời, xác minh nhanh tại hiện trường, điều phối xử lý phù hợp, và khép quy trình an toàn theo kết quả xác minh.

## 3. Scope
- Trigger / đầu vào: 1 trong 4 nhóm phát hiện dấu hiệu cháy.
- Điểm bắt đầu xử lý: [Nhân sự vận hành liên lạc (VOC)] Tiếp nhận tín hiệu ban đầu.
- Điểm kết thúc chính: [Trưởng điều phối khán giả (VOC)] Kết thúc quy trình.
- Phạm vi bao phủ: Quy trình bao phủ từ bước "Tiếp nhận tín hiệu ban đầu" đến bước "Kết thúc quy trình", với 2 điểm quyết định điều hướng nhánh xử lý.
- Thông tin tổng quan: 4 actor tham gia và 11 bước chính trong luồng xử lý.

## 4. Actors
- Nguồn phát hiện đầu tiên
  - Khởi phát tín hiệu hoặc cung cấp thông tin đầu vào ban đầu cho quy trình.
- Nhân sự vận hành liên lạc (VOC)
  - Tiếp nhận, ghi nhận, và lưu vết thông tin ban đầu của quy trình.
  - Điều phối hoặc chuyển giao xử lý cho đúng actor liên quan theo diễn biến thực tế.
  - Thực hiện hoặc theo dõi biện pháp xử lý phù hợp với tình huống đã được xác minh.
- Trưởng điều phối khán giả (VOC)
  - Tiếp nhận, ghi nhận, và lưu vết thông tin ban đầu của quy trình.
  - Điều phối hoặc chuyển giao xử lý cho đúng actor liên quan theo diễn biến thực tế.
  - Thực hiện hoặc theo dõi biện pháp xử lý phù hợp với tình huống đã được xác minh.
- Nhân viên hiện trường
  - Tiếp nhận, ghi nhận, và lưu vết thông tin ban đầu của quy trình.
  - Điều phối hoặc chuyển giao xử lý cho đúng actor liên quan theo diễn biến thực tế.
  - Kiểm tra, xác minh, và xác định hướng xử lý tiếp theo theo tình huống thực tế.

## 5. Main workflow
1. [Nhân sự vận hành liên lạc (VOC)] Tiếp nhận tín hiệu ban đầu
   - Đầu vào / kích hoạt: Tín hiệu hoặc thông tin đầu vào được khởi phát từ Nguồn phát hiện đầu tiên: 1 trong 4 nhóm phát hiện dấu hiệu cháy.
   - Mục đích: Ghi nhận tín hiệu hoặc thông tin đầu vào để khởi động quy trình xử lý.
   - Thực hiện: Nhân sự vận hành liên lạc (VOC) tiếp nhận tín hiệu hoặc tin báo ban đầu từ nguồn khởi phát liên quan.
   - Kết quả mong đợi: Tín hiệu ban đầu đã được ghi nhận để tiếp tục xử lý.
1. [Nhân sự vận hành liên lạc (VOC)] Mở nhật ký sự cố
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Tiếp nhận tín hiệu ban đầu".
   - Mục đích: Thiết lập đầu mối theo dõi để lưu lại các diễn biến xử lý tiếp theo.
   - Thực hiện: Nhân sự vận hành liên lạc (VOC) tạo hoặc mở hồ sơ theo dõi để lưu lại diễn biến xử lý.
   - Kết quả mong đợi: Đã có bản ghi theo dõi để cập nhật các diễn biến tiếp theo.
1. [Nhân sự vận hành liên lạc (VOC)] Ghi thời điểm, nguồn báo tin, vị trí sơ bộ
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Mở nhật ký sự cố".
   - Mục đích: Lưu lại thông tin ban đầu phục vụ xác minh và điều phối.
   - Thực hiện: Nhân sự vận hành liên lạc (VOC) cập nhật các thông tin đầu vào quan trọng như thời điểm, nguồn tin, và vị trí sơ bộ.
   - Kết quả mong đợi: Thông tin đầu vào ban đầu đã đủ để phục vụ bước điều phối hoặc xác minh.
1. [Nhân sự vận hành liên lạc (VOC)] Báo tín hiệu cho các actor chính
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Ghi thời điểm, nguồn báo tin, vị trí sơ bộ".
   - Mục đích: Kích hoạt phối hợp giữa các actor liên quan để bước xử lý không bị chậm trễ.
   - Thực hiện: Nhân sự vận hành liên lạc (VOC) chuyển thông tin đến các actor chính để cùng phối hợp xử lý.
   - Kết quả mong đợi: Các actor liên quan đã nhận được thông tin cần thiết để tiếp tục phối hợp.
1. [Trưởng điều phối khán giả (VOC)] Điều phối nhân viên hiện trường gần nhất qua bộ đàm đến điểm nghi vấn
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Báo tín hiệu cho các actor chính".
   - Mục đích: Phân công nguồn lực phù hợp đến đúng điểm xử lý hoặc hiện trường nghi vấn.
   - Thực hiện: Trưởng điều phối khán giả (VOC) điều phối nhân sự hoặc nguồn lực phù hợp đến điểm cần xử lý.
   - Kết quả mong đợi: Nguồn lực phù hợp đã được phân công đến điểm xử lý.
1. [Nhân viên hiện trường] Di chuyển đến điểm nghi vấn để kiểm tra
   - Đầu vào / kích hoạt: Bàn giao xử lý từ bước "Điều phối nhân viên hiện trường gần nhất qua bộ đàm đến điểm nghi vấn" sang bước "Di chuyển đến điểm nghi vấn để kiểm tra".
   - Mục đích: Đưa nhân sự đến hiện trường để kiểm tra trực tiếp tình trạng thực tế.
   - Thực hiện: Sau khi tiếp nhận bàn giao từ Trưởng điều phối khán giả (VOC), Nhân viên hiện trường di chuyển đến hiện trường hoặc điểm nghi vấn để kiểm tra thực tế.
   - Kết quả mong đợi: Hiện trường sẵn sàng cho bước xác minh trực tiếp.
1. [Nhân viên hiện trường] Ra quyết định: Xác minh sự cố là cháy thật?
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Di chuyển đến điểm nghi vấn để kiểm tra".
   - Mục đích: Xác định nhánh xử lý tiếp theo dựa trên thông tin đã được xác minh.
   - Thực hiện: Nhân viên hiện trường đánh giá câu hỏi nghiệp vụ "Xác minh sự cố là cháy thật?" để chọn nhánh xử lý tiếp theo.
   - Kết quả mong đợi: Đã xác định được nhánh xử lý tiếp theo cho quy trình.
1. [Nhân viên hiện trường] Xác nhận thông tin đúng
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Ra quyết định: Xác minh sự cố là cháy thật?".
   - Mục đích: Ghi nhận tín hiệu hoặc thông tin đầu vào để khởi động quy trình xử lý.
   - Thực hiện: Nhân viên hiện trường tiếp nhận tín hiệu hoặc tin báo ban đầu từ nguồn khởi phát liên quan.
   - Kết quả mong đợi: Tín hiệu ban đầu đã được ghi nhận để tiếp tục xử lý.
1. [Nhân viên hiện trường] Ra quyết định: Có thể xử lý nhanh không?
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Xác nhận thông tin đúng".
   - Mục đích: Xác định nhánh xử lý tiếp theo dựa trên thông tin đã được xác minh.
   - Thực hiện: Nhân viên hiện trường đánh giá câu hỏi nghiệp vụ "Có thể xử lý nhanh không?" để chọn nhánh xử lý tiếp theo.
   - Kết quả mong đợi: Đã xác định được nhánh xử lý tiếp theo cho quy trình.
1. [Nhân viên hiện trường] Xử lý tình hình ngay
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Ra quyết định: Có thể xử lý nhanh không?".
   - Mục đích: Thực hiện biện pháp xử lý phù hợp với mức độ tình huống thực tế.
   - Thực hiện: Nhân viên hiện trường thực hiện biện pháp xử lý ban đầu phù hợp với tình huống đã được xác minh.
   - Kết quả mong đợi: Tình huống đã được xử lý hoặc đưa về trạng thái kiểm soát ban đầu.
1. [Trưởng điều phối khán giả (VOC)] Kết thúc quy trình
   - Đầu vào / kích hoạt: Sau khi hoàn tất bước "Xử lý tình hình ngay".
   - Mục đích: Khép quy trình sau khi đã có kết quả xử lý hoặc kết luận xác minh.
   - Thực hiện: Trưởng điều phối khán giả (VOC) khép lại quy trình và ghi nhận trạng thái kết thúc.
   - Kết quả mong đợi: Quy trình được khép lại với trạng thái kết thúc rõ ràng.

## 6. Decision logic
- [Nhân viên hiện trường] Xác minh sự cố là cháy thật?
  - Không: Thực hiện lần lượt [Trưởng điều phối khán giả (VOC)] Xác nhận thông tin sai, rồi [Trưởng điều phối khán giả (VOC)] Báo cáo qua bộ đàm về kết quả xác minh cho các actor trong VOC; sau đó nhập lại luồng chính tại [Trưởng điều phối khán giả (VOC)] Kết thúc quy trình.
  - Có: Tiếp tục: [Nhân viên hiện trường] Xác nhận thông tin đúng.
- [Nhân viên hiện trường] Có thể xử lý nhanh không?
  - Không: [Trưởng điều phối khán giả (VOC)] Báo cáo qua bộ đàm về kết quả xác minh cho các actor trong VOC; sau đó nhập lại luồng chính tại [Trưởng điều phối khán giả (VOC)] Kết thúc quy trình.
  - Có: Tiếp tục: [Nhân viên hiện trường] Xử lý tình hình ngay.

## 7. Parallel activities
- Không có hoạt động song song đáng kể.

## 8. Handoffs
- Trưởng điều phối khán giả (VOC) -> Nhân viên hiện trường: Bàn giao xử lý từ bước "Điều phối nhân viên hiện trường gần nhất qua bộ đàm đến điểm nghi vấn" sang bước "Di chuyển đến điểm nghi vấn để kiểm tra".

## 9. Exceptions / warnings
- Không có warning nổi bật.

## 10. Context / assumptions / open questions
- Context: 1 trong 4 nhóm phát hiện dấu hiệu cháy.
  - Hệ thống tự động: Sensor báo khói, nhiệt
  - Khán giả: Nút báo cháy, mini app, hotline
  - Nhân viên hiện trường: Bộ đàm
  - Nhân sự CCTV