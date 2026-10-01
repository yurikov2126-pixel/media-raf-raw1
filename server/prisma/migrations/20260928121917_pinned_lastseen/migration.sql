-- AlterTable
ALTER TABLE "Chat" ADD COLUMN "pinnedMessageId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSeen" DATETIME;
