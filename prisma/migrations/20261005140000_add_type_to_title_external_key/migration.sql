-- У TMDB фильм и сериал с одним id — разные тайтлы, поэтому тип входит в ключ.
-- Новый индекс мягче старого, существующие строки его не нарушают

-- DropIndex
DROP INDEX "titles_external_source_external_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "titles_external_source_type_external_id_key" ON "titles"("external_source", "type", "external_id");
