BEGIN;

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'COORDENADOR');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
ALTER COLUMN "role" TYPE "Role_new"
USING ("role"::text::"Role_new");

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

ALTER TABLE "authors" DROP CONSTRAINT IF EXISTS "authors_user_id_fkey";
DROP INDEX IF EXISTS "authors_user_id_key";
ALTER TABLE "authors" DROP COLUMN "user_id";

COMMIT;
