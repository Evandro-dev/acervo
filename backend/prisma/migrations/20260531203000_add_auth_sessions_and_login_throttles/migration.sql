-- CreateEnum
CREATE TYPE "LoginThrottleScope" AS ENUM ('ACCOUNT', 'IP');

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_throttles" (
    "key" TEXT NOT NULL,
    "scope" "LoginThrottleScope" NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "lock_level" INTEGER NOT NULL DEFAULT 0,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "blocked_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- Enforce one active session per account at the database level.
CREATE UNIQUE INDEX "auth_sessions_one_active_per_user_key" ON "auth_sessions"("user_id") WHERE "revoked_at" IS NULL;

-- CreateIndex
CREATE INDEX "login_throttles_scope_expires_at_idx" ON "login_throttles"("scope", "expires_at");

-- CreateIndex
CREATE INDEX "login_throttles_expires_at_idx" ON "login_throttles"("expires_at");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
