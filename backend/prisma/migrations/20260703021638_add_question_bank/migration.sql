-- AlterTable
ALTER TABLE "exam_questions" ADD COLUMN     "questionBankId" TEXT;

-- CreateTable
CREATE TABLE "question_bank" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT,
    "difficulty" INTEGER NOT NULL,
    "questionType" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" JSONB NOT NULL,
    "explanation" TEXT,
    "examYear" INTEGER,
    "examCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_bank_subject_difficulty_isActive_idx" ON "question_bank"("subject", "difficulty", "isActive");

-- CreateIndex
CREATE INDEX "exam_questions_questionBankId_idx" ON "exam_questions"("questionBankId");

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "question_bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
