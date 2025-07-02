/*
  Warnings:

  - Made the column `created_at` on table `reservations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "reservations" ALTER COLUMN "first_name" SET DATA TYPE TEXT,
ALTER COLUMN "last_name" SET DATA TYPE TEXT,
ALTER COLUMN "phone" SET DATA TYPE TEXT,
ALTER COLUMN "email" SET DATA TYPE TEXT,
ALTER COLUMN "reservation_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reservation_time" SET DATA TYPE TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);
