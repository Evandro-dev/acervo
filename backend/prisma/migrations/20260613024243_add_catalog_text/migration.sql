/*
  Warnings:

  - You are about to drop the column `address` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `publisher` on the `events` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "events" DROP COLUMN "address",
DROP COLUMN "publisher",
ADD COLUMN     "catalog_text" TEXT;
