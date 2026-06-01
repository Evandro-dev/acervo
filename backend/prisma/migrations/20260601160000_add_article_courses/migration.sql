CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article_courses" (
    "article_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "article_courses_pkey" PRIMARY KEY ("article_id", "course_id")
);

CREATE UNIQUE INDEX "courses_normalized_name_key" ON "courses"("normalized_name");
CREATE INDEX "courses_name_idx" ON "courses"("name");
CREATE INDEX "article_courses_course_id_idx" ON "article_courses"("course_id");

ALTER TABLE "article_courses"
ADD CONSTRAINT "article_courses_article_id_fkey"
FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_courses"
ADD CONSTRAINT "article_courses_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
