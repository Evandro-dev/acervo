-- Normalize legacy visual placeholders and empty catalog fields to the nullable
-- representation used by the application. Valid ISBNs, DOIs and catalog files
-- are intentionally left untouched.
UPDATE "events"
SET "isbn" = NULL
WHERE "isbn" IS NOT NULL
  AND BTRIM("isbn") IN ('', chr(8212));

UPDATE "events"
SET "doi" = NULL
WHERE "doi" IS NOT NULL
  AND BTRIM("doi") IN ('', chr(8212));

UPDATE "events"
SET "catalog_text" = NULL
WHERE "catalog_text" IS NOT NULL
  AND BTRIM("catalog_text") = '';
