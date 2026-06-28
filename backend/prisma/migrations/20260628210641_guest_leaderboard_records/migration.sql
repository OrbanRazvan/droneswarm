/*
  Warnings:

  - A unique constraint covering the columns `[guestKey,gameMode]` on the table `GameModeStat` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GameModeStat" ADD COLUMN     "guestKey" TEXT,
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "GameModeStat_gameMode_isGuest_idx" ON "GameModeStat"("gameMode", "isGuest");

-- CreateIndex
CREATE UNIQUE INDEX "GameModeStat_guestKey_gameMode_key" ON "GameModeStat"("guestKey", "gameMode");
