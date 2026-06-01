CREATE TYPE "AccessAccountAuditAction" AS ENUM ('CREATED', 'UPDATED', 'DEACTIVATED', 'REACTIVATED');

ALTER TABLE "users"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deactivated_at" TIMESTAMP(3);

CREATE TABLE "access_account_audits" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "action" "AccessAccountAuditAction" NOT NULL,
    "changed_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_account_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_account_audits_target_user_id_created_at_idx"
ON "access_account_audits"("target_user_id", "created_at");

CREATE INDEX "access_account_audits_actor_user_id_created_at_idx"
ON "access_account_audits"("actor_user_id", "created_at");

ALTER TABLE "access_account_audits"
ADD CONSTRAINT "access_account_audits_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "access_account_audits"
ADD CONSTRAINT "access_account_audits_target_user_id_fkey"
FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
