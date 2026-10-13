CREATE TABLE "EditorialTeamMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EditorialTeamMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EditorialTeamMember_userId_key" ON "EditorialTeamMember"("userId");
CREATE INDEX "EditorialTeamMember_memberType_position_idx" ON "EditorialTeamMember"("memberType", "position");
ALTER TABLE "EditorialTeamMember" ADD CONSTRAINT "EditorialTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
