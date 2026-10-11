CREATE TABLE "GamificationSeason" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GamificationSeason_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GamificationSeason_dates_check" CHECK ("endsAt" > "startsAt")
);
CREATE UNIQUE INDEX "GamificationSeason_slug_key" ON "GamificationSeason"("slug");
CREATE INDEX "GamificationSeason_startsAt_endsAt_idx" ON "GamificationSeason"("startsAt", "endsAt");

CREATE TABLE "GamificationSeasonScore" (
  "seasonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GamificationSeasonScore_pkey" PRIMARY KEY ("seasonId", "userId")
);
CREATE INDEX "GamificationSeasonScore_seasonId_xp_idx" ON "GamificationSeasonScore"("seasonId", "xp");
ALTER TABLE "GamificationSeasonScore" ADD CONSTRAINT "GamificationSeasonScore_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GamificationSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamificationSeasonScore" ADD CONSTRAINT "GamificationSeasonScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Three inaugural seasons. Dates are UTC, half-open intervals [startsAt, endsAt).
-- Historical seasons start with empty scores; lifetime XP remains untouched.
INSERT INTO "GamificationSeason" ("id","slug","title","description","startsAt","endsAt")
VALUES
('season_2026_autumn','autumn-2026','Осенний кадр','Осенние съёмки, репортажи и новые истории','2026-10-01T00:00:00','2026-12-01T00:00:00'),
('season_2026_winter','winter-2026','Зимний объектив','Зимние проекты и командное творчество','2026-12-01T00:00:00','2027-03-01T00:00:00'),
('season_2027_spring','spring-2027','Весенний импульс','Новые идеи, свежие проекты и весенний контент','2027-03-01T00:00:00','2027-06-01T00:00:00');
