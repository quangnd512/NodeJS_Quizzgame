# Handoff từ S6-GiangGiai → S8-GiamSat

**Thời gian:** 2026-07-05  
**Branch:** feature/wrong-answer-review

---

[TỪ S6-GIANGGIAI]

✅ GIẢI THÍCH XONG: Ôn Câu Sai (Wrong Answer Review)
🌿 BRANCH: feature/wrong-answer-review

📚 TÀI LIỆU ĐÃ GHI:
- `docs/GLOSSARY.md`: 6 thuật ngữ mới (Upsert, TTL, Soft Expiry, Dual FK, In-Memory Pagination, normalizeAnswer)
- `docs/adr/008-in-memory-pagination-wrong-answers.md`: ADR giải thích quyết định phân trang trong bộ nhớ

---

👉 Yêu cầu: Rà soát toàn bộ kết quả của tính năng này so với yêu cầu ban đầu từ S1,
nếu đạt thì cho phép Session 7 push & merge.

Tham khảo kết quả chi tiết từ S3 (review + test): `workflow/handoff/s3-to-s4.md`
