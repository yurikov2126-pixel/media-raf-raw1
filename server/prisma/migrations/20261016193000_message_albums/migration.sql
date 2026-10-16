ALTER TABLE "Message" ADD COLUMN "albumId" TEXT;
CREATE INDEX "Message_albumId_idx" ON "Message"("albumId");
