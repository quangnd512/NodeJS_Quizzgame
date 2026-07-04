# ADR 007: Dùng Promise.all cho 9 query trong getSummary

## Bối cảnh
`getSummary` cần tổng hợp dữ liệu từ nhiều bảng khác nhau:
tổng số phiên, điểm tích lũy, thống kê tháng, lịch sử điểm, thống kê theo môn.
Tất cả các query này độc lập nhau — không query nào cần kết quả của query khác.

## Quyết định
Dùng `Promise.all([...9 queries...])` để chạy tất cả song song trong một lần gọi.

## Lý do
- Gọi tuần tự sẽ mất ~400ms (tổng cộng); song song chỉ mất ~60ms (query chậm nhất).
- Các query hoàn toàn độc lập nên không có rủi ro race condition hay dirty read.
- Đã cân nhắc tách thành nhiều endpoint nhỏ hơn, nhưng frontend cần tất cả dữ liệu
  cùng lúc để render dashboard — gọi 1 request tốt hơn 9 request riêng lẻ từ client.
