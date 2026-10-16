-- PostgreSQL INTEGER stores at most 2,147,483,647 bytes (~2 GiB).
-- DOUBLE PRECISION represents every integer byte count exactly up to 2^53,
-- while Prisma Float serializes as a regular JavaScript number in existing APIs.
ALTER TABLE "EditorialLibraryFile" ALTER COLUMN "size" TYPE DOUBLE PRECISION USING "size"::DOUBLE PRECISION;
ALTER TABLE "EditorialMaterialFile" ALTER COLUMN "size" TYPE DOUBLE PRECISION USING "size"::DOUBLE PRECISION;
