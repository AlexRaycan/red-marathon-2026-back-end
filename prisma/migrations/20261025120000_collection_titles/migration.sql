-- CreateTable
CREATE TABLE "collection_titles" (
    "collection_id" TEXT NOT NULL,
    "title_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_titles_pkey" PRIMARY KEY ("collection_id","title_id")
);

-- CreateIndex
CREATE INDEX "collection_titles_title_id_idx" ON "collection_titles"("title_id");

-- AddForeignKey
ALTER TABLE "collection_titles" ADD CONSTRAINT "collection_titles_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_titles" ADD CONSTRAINT "collection_titles_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Перенос связей из неявной таблицы: A — подборка, B — тайтл.
-- Реальной даты добавления у старых связей нет, поэтому added_at = now()
INSERT INTO "collection_titles" ("collection_id", "title_id", "added_at")
SELECT "A", "B", now() FROM "_CollectionToTitle";

-- DropTable
DROP TABLE "_CollectionToTitle";
