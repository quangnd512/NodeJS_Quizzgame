-- Cho phep hoc sinh bao cao LAI 1 cau hoi da tung bao cao, NEU report truoc do da
-- duoc admin xu ly xong (FIXED/DISMISSED). Chi chan khi report gan nhat con PENDING
-- (dung PARTIAL UNIQUE INDEX thay cho UNIQUE constraint toan bo (userId, questionId)
-- nhu truoc - Prisma schema khong khai bao duoc partial index nen chi ap dung qua
-- raw SQL migration, service layer da tu kiem tra logic tuong ung).

-- Bo UNIQUE index cu (chan bao cao lai vinh vien). Luu y: day la UNIQUE INDEX
-- (Prisma tao truc tiep qua CREATE UNIQUE INDEX cho @@unique), khong phai table
-- CONSTRAINT, nen phai dung DROP INDEX (khong the dung ALTER TABLE DROP CONSTRAINT).
DROP INDEX "question_reports_userId_questionId_key";

-- Index thuong (khong unique) de truy van "report gan nhat cua user cho 1 cau" nhanh.
CREATE INDEX "question_reports_userId_questionId_idx" ON "question_reports" ("userId", "questionId");

-- PARTIAL UNIQUE INDEX: chi cho phep TOI DA 1 report PENDING / user / cau hoi tai
-- 1 thoi diem - chong race condition (2 request bao cao dong thoi).
CREATE UNIQUE INDEX "question_reports_user_question_pending_key"
  ON "question_reports" ("userId", "questionId")
  WHERE status = 'PENDING';
