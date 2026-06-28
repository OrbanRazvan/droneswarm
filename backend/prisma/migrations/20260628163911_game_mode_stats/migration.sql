-- CreateTable
CREATE TABLE "GameModeStat" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "gameMode" TEXT NOT NULL,
    "bestKills" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameModeStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameModeStat_gameMode_bestKills_idx" ON "GameModeStat"("gameMode", "bestKills");

-- CreateIndex
CREATE INDEX "GameModeStat_gameMode_wins_idx" ON "GameModeStat"("gameMode", "wins");

-- CreateIndex
CREATE UNIQUE INDEX "GameModeStat_userId_gameMode_key" ON "GameModeStat"("userId", "gameMode");
