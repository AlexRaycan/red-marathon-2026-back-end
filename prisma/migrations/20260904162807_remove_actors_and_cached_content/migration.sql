/*
  Warnings:

  - You are about to drop the column `description` on the `titles` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `titles` table. All the data in the column will be lost.
  - You are about to drop the `_ActorToTitle` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `actors` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ActorToTitle" DROP CONSTRAINT "_ActorToTitle_A_fkey";

-- DropForeignKey
ALTER TABLE "_ActorToTitle" DROP CONSTRAINT "_ActorToTitle_B_fkey";

-- AlterTable
ALTER TABLE "titles" DROP COLUMN "description",
DROP COLUMN "metadata";

-- DropTable
DROP TABLE "_ActorToTitle";

-- DropTable
DROP TABLE "actors";
