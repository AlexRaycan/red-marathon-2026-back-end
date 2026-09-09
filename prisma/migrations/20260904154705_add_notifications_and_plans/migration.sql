/*
  Warnings:

  - The values [SHARED_CONTENT] on the enum `notification_types` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "notification_entities" AS ENUM ('COLLECTION', 'TITLE', 'REVIEW');

-- CreateEnum
CREATE TYPE "subscription_plans" AS ENUM ('FREE', 'PRO');

-- AlterEnum
BEGIN;
CREATE TYPE "notification_types_new" AS ENUM ('SYSTEM', 'COLLECTION_SHARED', 'REVIEW_REPLY', 'SUBSCRIPTION', 'RECOMMENDATION');
ALTER TABLE "public"."notifications" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "notification_types_new" USING ("type"::text::"notification_types_new");
ALTER TYPE "notification_types" RENAME TO "notification_types_old";
ALTER TYPE "notification_types_new" RENAME TO "notification_types";
DROP TYPE "public"."notification_types_old";
ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'SYSTEM';
COMMIT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "actor_id" UUID,
ADD COLUMN     "entity_id" UUID,
ADD COLUMN     "entity_type" "notification_entities";

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "plan" "subscription_plans" NOT NULL DEFAULT 'FREE';

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
