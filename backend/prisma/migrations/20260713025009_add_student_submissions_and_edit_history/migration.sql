-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SUBMISSION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBMISSION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBMISSION_USED';

-- CreateTable
CREATE TABLE "question_edit_history" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reportId" TEXT,
    "beforeData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_edit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_question_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "chapter" TEXT,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOptionIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "questionBankId" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "usagePointsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_question_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_edit_history_questionId_createdAt_idx" ON "question_edit_history"("questionId", "createdAt");

-- CreateIndex
CREATE INDEX "student_question_submissions_userId_status_createdAt_idx" ON "student_question_submissions"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "student_question_submissions_questionBankId_idx" ON "student_question_submissions"("questionBankId");

-- RenameForeignKey
ALTER TABLE "notifications" RENAME CONSTRAINT "notifications_userid_fkey" TO "notifications_userId_fkey";

-- AddForeignKey
ALTER TABLE "student_question_submissions" ADD CONSTRAINT "student_question_submissions_questionBankId_fkey" FOREIGN KEY ("questionBankId") REFERENCES "question_bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_question_submissions" ADD CONSTRAINT "student_question_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "notifications_userid_isread_createdat_idx" RENAME TO "notifications_userId_isRead_createdAt_idx";

