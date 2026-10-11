CREATE TABLE "StickerTrade" ("id" TEXT NOT NULL,"senderId" TEXT NOT NULL,"receiverId" TEXT NOT NULL,"offeredStickerId" TEXT NOT NULL,"requestedStickerId" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'PENDING',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"resolvedAt" TIMESTAMP(3),CONSTRAINT "StickerTrade_pkey" PRIMARY KEY ("id"));
CREATE INDEX "StickerTrade_receiverId_status_idx" ON "StickerTrade"("receiverId","status");
CREATE INDEX "StickerTrade_senderId_status_idx" ON "StickerTrade"("senderId","status");
ALTER TABLE "StickerTrade" ADD CONSTRAINT "StickerTrade_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StickerTrade" ADD CONSTRAINT "StickerTrade_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
