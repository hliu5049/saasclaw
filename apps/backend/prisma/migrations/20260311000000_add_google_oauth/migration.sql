-- Make password nullable for OAuth-only accounts
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- Add googleId column
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;

-- Add unique constraint
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
