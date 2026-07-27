-- CreateTable
CREATE TABLE "battle_matches" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "stake" INTEGER NOT NULL,
    "player1Id" TEXT NOT NULL,
    "player2Id" TEXT,
    "isBotMatch" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "winnerId" TEXT,
    "player1Score" INTEGER NOT NULL DEFAULT 0,
    "player2Score" INTEGER NOT NULL DEFAULT 0,
    "roomCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "battle_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_answers" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT,
    "questionIndex" INTEGER NOT NULL,
    "questionBankId" TEXT NOT NULL,
    "selectedOption" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "battle_matches_roomCode_key" ON "battle_matches"("roomCode");

-- CreateIndex
CREATE INDEX "battle_matches_player1Id_createdAt_idx" ON "battle_matches"("player1Id", "createdAt");

-- CreateIndex
CREATE INDEX "battle_matches_player2Id_createdAt_idx" ON "battle_matches"("player2Id", "createdAt");

-- CreateIndex
CREATE INDEX "battle_answers_matchId_questionIndex_idx" ON "battle_answers"("matchId", "questionIndex");

-- AddForeignKey
ALTER TABLE "battle_answers" ADD CONSTRAINT "battle_answers_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "battle_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

