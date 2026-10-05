-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "chatMode" TEXT NOT NULL DEFAULT 'staff';
ALTER TABLE "AppSettings" ADD COLUMN "sageMenuPageSize" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "AppSettings" ADD COLUMN "sageDecisionModel" TEXT NOT NULL DEFAULT 'typesafe/jev-1.13';
ALTER TABLE "AppSettings" ADD COLUMN "sageShowTechnicalDetails" BOOLEAN NOT NULL DEFAULT false;

-- The chat mode that matches the old switch: on meant Sage with the staff
-- behind it, off meant no chat. liveChatEnabled stays, unread.
UPDATE "AppSettings" SET "chatMode" = CASE WHEN "liveChatEnabled" THEN 'mixed' ELSE 'off' END;
