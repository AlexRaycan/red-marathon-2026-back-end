-- CreateEnum
CREATE TYPE "rating_scales" AS ENUM ('FIVE', 'TEN');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "rating_scale" "rating_scales" NOT NULL DEFAULT 'TEN';
