-- A usual amount of dishes, apart from the most one message may hold.
ALTER TABLE "AppSettings" ADD COLUMN "sageMenuDefaultCount" INTEGER NOT NULL DEFAULT 4;

-- 6 was the old factory value, and it meant both the usual amount and the cap.
-- A row still on 6 takes the new cap of 8. A row someone already changed keeps that number as the cap.
UPDATE "AppSettings" SET "sageMenuPageSize" = 8 WHERE "sageMenuPageSize" = 6;
ALTER TABLE "AppSettings" ALTER COLUMN "sageMenuPageSize" SET DEFAULT 8;

-- The usual amount cannot sit above the cap. A cap of 3 leaves the usual amount at 3.
UPDATE "AppSettings" SET "sageMenuDefaultCount" = "sageMenuPageSize" WHERE "sageMenuDefaultCount" > "sageMenuPageSize";
