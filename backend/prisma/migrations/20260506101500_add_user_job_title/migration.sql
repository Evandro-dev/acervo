ALTER TABLE "users"
ADD COLUMN "job_title" TEXT;

UPDATE "users"
SET "job_title" = CASE
    WHEN "role" = 'ADMIN' THEN 'Administrador(a) do ACERVO'
    ELSE 'Coordenador(a) do ACERVO'
END
WHERE "job_title" IS NULL;
