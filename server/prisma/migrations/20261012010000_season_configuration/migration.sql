ALTER TABLE "GamificationSeason" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GamificationSeason" ADD COLUMN "rules" TEXT NOT NULL DEFAULT '';
ALTER TABLE "GamificationSeason" ADD COLUMN "rewards" TEXT NOT NULL DEFAULT '';
UPDATE "GamificationSeason" SET "rules" = 'Участвуйте в жизни медиацентра, выполняйте задания и получайте XP. В сезонный рейтинг входят XP, начисленные в период сезона. Общий XP и уровни сохраняются.', "rewards" = 'Награды будут объявлены организаторами.' WHERE "rules" = '';
INSERT INTO "Setting" ("key","value") VALUES ('gamification_seasons_enabled','true') ON CONFLICT ("key") DO NOTHING;
