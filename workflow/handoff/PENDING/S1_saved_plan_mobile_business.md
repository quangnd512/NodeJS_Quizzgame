[KẾ HOẠCH ĐÃ LƯU — ROADMAP PHÁT TRIỂN MOBILE]
Ngày lưu: 2026-07-07
Cập nhật: 2026-07-07

== MÔ HÌNH KINH DOANH ==
- Nền tảng: React Native (iOS + Android)
- Miễn phí: 10 phiên luyện tập/ngày, xem quảng cáo để thêm 1 phiên hoặc xem đáp án thi
- Free đổi môn: phải thi ≥10 phiên/tháng + xem quảng cáo
- Free thi thử xong: chỉ hiện điểm (không có đáp án, không lưu lịch sử)
- Premium trả phí theo tháng: không giới hạn phiên, xem đáp án thi, ôn câu sai (+1đ/lần đúng đúng), đổi môn tự do, xem lịch sử thi đầy đủ

== GIAI ĐOẠN 1 — Nền móng mobile ==
- Dựng React Native app + navigation + kết nối backend API hiện có
- Dark mode (hỗ trợ ngay từ đầu, dễ hơn thêm sau)

== GIAI ĐOẠN 2 — Monetization core ==
- Subscription system: DB tables (subscriptions, plans) + Apple StoreKit + Google Play Billing
- Backend xác thực receipt (server-side validation với Apple/Google)
- Dùng thử Premium 7 ngày miễn phí (trial period)
- Restore Purchases (bắt buộc theo Apple App Store policy)
- AdMob rewarded ads: 2 placement (thêm phiên luyện tập / mở kết quả thi)
- Backend endpoint xác thực "đã xem quảng cáo" (server-side, không tin client)
- Feature gating (Free vs Premium) xuyên suốt app

== GIAI ĐOẠN 3 — Điều chỉnh tính năng cũ ==
- Giới hạn 10 phiên/ngày (thay Redis hourly → DB daily counter)
- Kết quả thi: Free chỉ hiện điểm, Premium hiện đầy đủ
- Khoá "Ôn câu sai" cho Premium + thêm +1đ mỗi lần làm đúng
- Điều kiện đổi môn cho Free (≥10 phiên thi/tháng + xem quảng cáo)
- Tự xoá tài khoản (bắt buộc theo Apple App Store policy 2023)

== GIAI ĐOẠN 4 — Giữ chân & tăng trưởng ==
- Push notification nhắc học hàng ngày (Feature 009 — FCM Android + APNs iOS)
- Chia sẻ kết quả lên mạng xã hội (Zalo/Facebook/TikTok)
- Offline mode: cache câu hỏi để dùng khi mất mạng, sync lại sau

== GIAI ĐOẠN 5 — Pháp lý + xuất bản ==
- Privacy Policy + Terms of Service (trang web riêng)
- Khai báo thu thập dữ liệu (GDPR / App Store privacy label)
- Submit App Store + Google Play

== DANH SÁCH ĐẦY ĐỦ CÁC TÍNH NĂNG CẦN LÀM ==

[BẮT BUỘC — App Store từ chối nếu thiếu]
□ Tự xoá tài khoản (Apple policy 2023)
□ Restore Purchases (Apple/Google policy)

[MONETIZATION]
□ Subscription system (DB + IAP Apple/Google + webhook validation)
□ Dùng thử Premium 7 ngày miễn phí
□ AdMob rewarded ads (thêm phiên + mở kết quả thi)
□ Backend xác thực "đã xem quảng cáo"
□ Feature gating Free vs Premium

[ĐIỀU CHỈNH TÍNH NĂNG CŨ]
□ Giới hạn 10 phiên/ngày thay vì 10/giờ (Redis → DB daily counter)
□ Kết quả thi theo gói (Free: điểm, Premium: đầy đủ)
□ Ôn câu sai → Premium only + +1đ mỗi lần đúng
□ Điều kiện đổi môn cho Free
□ Lịch sử thi thử chi tiết → Premium only

[TĂNG TRƯỞNG & GIỮ CHÂN]
□ Push notification nhắc học hàng ngày (Feature 009)
□ Chia sẻ kết quả lên Zalo/Facebook/TikTok
□ Dùng thử Premium 7 ngày (trial)

[TRẢI NGHIỆM]
□ Dark mode
□ Offline mode (cache câu hỏi, sync sau)
□ React Native app (toàn bộ frontend)

[PHÁP LÝ]
□ Privacy Policy + Terms of Service
□ App Store / Google Play submission

== LƯU Ý KỸ THUẬT ==
- Backend API Node.js/Express giữ nguyên, chỉ thay frontend
- Firebase Auth cần adapter cho React Native (expo-auth-session hoặc @react-native-google-signin)
- Wrong Answer Review (Feature 010) đã có backend, cần khoá Premium + thêm điểm
- Progress Dashboard đã có, cần phân quyền xem lịch sử chi tiết
- Hệ thống điểm đã có, cần thêm endpoint "reward sau khi xem quảng cáo"
- Push notification: cần thêm bảng device_tokens trong DB
- Offline mode: cần chiến lược cache (React Query / AsyncStorage)
