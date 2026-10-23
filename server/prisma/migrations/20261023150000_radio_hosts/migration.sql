CREATE TABLE "RadioHost" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "photoUrl" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "RadioHost_pkey" PRIMARY KEY ("id"));
CREATE TABLE "RadioScheduleHost" ("slotId" TEXT NOT NULL, "hostId" TEXT NOT NULL, "position" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "RadioScheduleHost_pkey" PRIMARY KEY ("slotId","hostId"));
CREATE INDEX "RadioScheduleHost_hostId_idx" ON "RadioScheduleHost"("hostId");
ALTER TABLE "RadioScheduleHost" ADD CONSTRAINT "RadioScheduleHost_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "RadioScheduleSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RadioScheduleHost" ADD CONSTRAINT "RadioScheduleHost_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "RadioHost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
