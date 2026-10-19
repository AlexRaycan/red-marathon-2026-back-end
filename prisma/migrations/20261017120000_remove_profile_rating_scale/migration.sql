-- Шкала отображения оценок убрана: оценки везде 10-балльные,
-- клиенту больше не нужно выбирать, как их показывать

-- AlterTable
ALTER TABLE "profiles" DROP COLUMN "rating_scale";

-- DropEnum
DROP TYPE "rating_scales";
