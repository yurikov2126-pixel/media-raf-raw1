CREATE TABLE "PhotoAlbum" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "photos" TEXT NOT NULL DEFAULT '[]',
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhotoAlbum_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PhotoAlbum_ownerId_createdAt_idx" ON "PhotoAlbum"("ownerId", "createdAt");
ALTER TABLE "PhotoAlbum" ADD CONSTRAINT "PhotoAlbum_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
