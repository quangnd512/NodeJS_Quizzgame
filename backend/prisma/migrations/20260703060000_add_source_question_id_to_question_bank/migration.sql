-- AddColumn sourceQuestionId (nullable, unique) vào question_bank
-- Dùng bởi seed script để liên kết câu hỏi ngân hàng với câu hỏi gốc trong bảng questions.
-- @unique đảm bảo seed script idempotent: chạy nhiều lần không tạo duplicate.

ALTER TABLE "question_bank" ADD COLUMN "sourceQuestionId" TEXT;
CREATE UNIQUE INDEX "question_bank_sourceQuestionId_key" ON "question_bank"("sourceQuestionId");
