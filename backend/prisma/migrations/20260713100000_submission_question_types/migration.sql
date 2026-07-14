-- Ho tro 3 dang cau hoi (MCQ_4 | TRUE_FALSE_4 | FILL_BLANK) cho submission hoc sinh gui,
-- giong quy uoc da dung o QuestionBank/ExamQuestion.

-- Them cot questionType (mac dinh MCQ_4 de tuong thich nguoc voi du lieu cu neu co).
ALTER TABLE "student_question_submissions" ADD COLUMN "questionType" TEXT NOT NULL DEFAULT 'MCQ_4';

-- Them cot correctAnswer (JSON, linh hoat theo dang cau hoi) thay cho correctOptionIndex.
ALTER TABLE "student_question_submissions" ADD COLUMN "correctAnswer" JSONB;

-- Backfill du lieu cu (neu co): chuyen correctOptionIndex (so) thanh correctAnswer (JSON so).
UPDATE "student_question_submissions" SET "correctAnswer" = to_jsonb("correctOptionIndex") WHERE "correctAnswer" IS NULL;

-- Sau khi backfill, correctAnswer luon co gia tri -> set NOT NULL.
ALTER TABLE "student_question_submissions" ALTER COLUMN "correctAnswer" SET NOT NULL;

-- options gio nullable (FILL_BLANK khong co options, giong QuestionBank.options).
ALTER TABLE "student_question_submissions" ALTER COLUMN "options" DROP NOT NULL;

-- Bo cot cu, khong con dung.
ALTER TABLE "student_question_submissions" DROP COLUMN "correctOptionIndex";
