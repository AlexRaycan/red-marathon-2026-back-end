-- AlterEnum
ALTER TYPE "rating_scales" ADD VALUE 'AUTO';

-- AlterTable
ALTER TABLE "profiles" ALTER COLUMN "rating_scale" SET DEFAULT 'AUTO';
