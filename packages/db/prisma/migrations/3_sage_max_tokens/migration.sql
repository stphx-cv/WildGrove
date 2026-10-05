-- Reasoning counts against the cap, and at 600 it could spend the whole reply before the first word.
-- A row still on the old factory value takes the new one. A row someone already changed keeps its number.
UPDATE "AppSettings" SET "aiMaxTokens" = 1600 WHERE "aiMaxTokens" = 600;
ALTER TABLE "AppSettings" ALTER COLUMN "aiMaxTokens" SET DEFAULT 1600;
