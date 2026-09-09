/*
  Warnings:

  - You are about to drop the column `external_customer_id` on the `subscriptions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[original_transaction_id]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "subscription_providers" AS ENUM ('APPLE', 'GOOGLE');

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "external_customer_id",
ADD COLUMN     "last_verified_at" TIMESTAMP(3),
ADD COLUMN     "original_transaction_id" TEXT,
ADD COLUMN     "product_id" TEXT,
ADD COLUMN     "provider" "subscription_providers",
ADD COLUMN     "purchase_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_original_transaction_id_key" ON "subscriptions"("original_transaction_id");

-- CreateIndex
CREATE INDEX "subscriptions_purchase_token_idx" ON "subscriptions"("purchase_token");
