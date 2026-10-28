ALTER TABLE "SafetyMchsHealth"
 ADD COLUMN "queuedLocal" INTEGER,
 ADD COLUMN "failedSends" INTEGER,
 ADD COLUMN "lastSentAt" TIMESTAMP(3),
 ADD COLUMN "telemetryAt" TIMESTAMP(3);