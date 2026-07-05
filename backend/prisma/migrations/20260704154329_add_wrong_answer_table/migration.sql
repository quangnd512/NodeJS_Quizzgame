-- CreateTable
CREATE TABLE "wrong_answers" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT,
    "examQuestionId" TEXT,
    "wrongCount" INTEGER NOT NULL DEFAULT 1,
    "lastWrongAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wrong_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wrong_answers_userId_questionId_key" ON "wrong_answers"("userId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "wrong_answers_userId_examQuestionId_key" ON "wrong_answers"("userId", "examQuestionId");

-- CreateIndex: toc do query chinh lay cau sai chua het han cua 1 user
CREATE INDEX "wrong_answers_userId_expiresAt_idx" ON "wrong_answers"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "wrong_answers" ADD CONSTRAINT "wrong_answers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wrong_answers" ADD CONSTRAINT "wrong_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wrong_answers" ADD CONSTRAINT "wrong_answers_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "exam_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
