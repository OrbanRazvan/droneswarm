/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `GameUser` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GameUser" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "username" TEXT NOT NULL,
    "gameMode" TEXT NOT NULL DEFAULT 'battle-royale',
    "kills" INTEGER NOT NULL DEFAULT 0,
    "totalCollected" INTEGER NOT NULL DEFAULT 0,
    "placement" INTEGER NOT NULL,
    "totalPlayers" INTEGER NOT NULL DEFAULT 60,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "skin" TEXT NOT NULL DEFAULT 'cyan',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchResult_userId_idx" ON "MatchResult"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameUser_username_key" ON "GameUser"("username");
