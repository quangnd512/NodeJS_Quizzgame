-- CreateTable
CREATE TABLE "exam_papers" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" TEXT NOT NULL,
    "examPaperId" TEXT NOT NULL,
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

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examPaperId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DOUBLE PRECISION,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_answers" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "examQuestionId" TEXT NOT NULL,
    "selectedAnswer" JSONB NOT NULL,
    "pointsEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_papers_subject_isActive_idx" ON "exam_papers"("subject", "isActive");

-- CreateIndex
CREATE INDEX "exam_questions_examPaperId_isActive_idx" ON "exam_questions"("examPaperId", "isActive");

-- CreateIndex
CREATE INDEX "exam_sessions_userId_examPaperId_idx" ON "exam_sessions"("userId", "examPaperId");

-- CreateIndex
CREATE INDEX "exam_sessions_userId_completedAt_idx" ON "exam_sessions"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "exam_answers_sessionId_examQuestionId_key" ON "exam_answers"("sessionId", "examQuestionId");
