CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "articles" ADD COLUMN "area_id" TEXT;

CREATE UNIQUE INDEX "areas_normalized_name_key" ON "areas"("normalized_name");
CREATE INDEX "areas_name_idx" ON "areas"("name");
CREATE INDEX "articles_area_id_idx" ON "articles"("area_id");

INSERT INTO "areas" ("id", "name", "normalized_name", "created_at", "updated_at")
SELECT
    'area_' || md5(regexp_replace(trim("area"), '\s+', ' ', 'g')),
    regexp_replace(trim("area"), '\s+', ' ', 'g'),
    lower(regexp_replace(trim("area"), '\s+', ' ', 'g')),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "articles"
WHERE trim("area") <> ''
GROUP BY regexp_replace(trim("area"), '\s+', ' ', 'g');

UPDATE "articles" AS "article"
SET "area_id" = "area"."id"
FROM "areas" AS "area"
WHERE "area"."normalized_name" = lower(regexp_replace(trim("article"."area"), '\s+', ' ', 'g'));

ALTER TABLE "articles"
ADD CONSTRAINT "articles_area_id_fkey"
FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
