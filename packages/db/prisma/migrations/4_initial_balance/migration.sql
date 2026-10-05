-- A movement type for the test balance an account receives when it is created.
ALTER TYPE "WalletTransactionType" ADD VALUE 'INITIAL_BALANCE';

-- The two amounts credited to each new account. The default fills the existing row,
-- so no UPDATE is needed. 0 leaves that currency empty.
ALTER TABLE "AppSettings" ADD COLUMN "initialBalancePEN" DECIMAL(12,2) NOT NULL DEFAULT 200;
ALTER TABLE "AppSettings" ADD COLUMN "initialBalanceUSD" DECIMAL(12,2) NOT NULL DEFAULT 80;
