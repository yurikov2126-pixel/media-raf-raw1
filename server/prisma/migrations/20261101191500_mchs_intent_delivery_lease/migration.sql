ALTER TABLE "SafetyMchsPlaybackIntent"
 ADD COLUMN "leaseToken" TEXT,
 ADD COLUMN "leaseUntil" TIMESTAMP(3),
 ADD COLUMN "acknowledgedAt" TIMESTAMP(3);
CREATE INDEX "SafetyMchsPlaybackIntent_leaseUntil_idx" ON "SafetyMchsPlaybackIntent"("leaseUntil");
