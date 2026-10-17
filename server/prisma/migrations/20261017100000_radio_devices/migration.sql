CREATE TABLE "RadioDevice" (
"id" TEXT NOT NULL, "name" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"lastSeenAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
CONSTRAINT "RadioDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RadioDevice_tokenHash_key" ON "RadioDevice"("tokenHash");
