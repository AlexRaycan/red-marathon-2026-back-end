-- Оценка пользователя теперь живёт только в отзыве. Переносим оценки
-- из библиотеки как отзывы без текста; если отзыв уже есть — его оценка
-- главнее. id отзывов Prisma генерирует как cuid, в SQL его не получить,
-- поэтому здесь uuid: колонка текстовая, формат id нигде не проверяется
INSERT INTO "reviews" ("id", "rating", "text", "is_public", "user_id", "title_id", "updated_at")
SELECT gen_random_uuid()::text, "rating", NULL, true, "user_id", "title_id", CURRENT_TIMESTAMP
FROM "library_entries"
WHERE "rating" IS NOT NULL
ON CONFLICT ("user_id", "title_id") DO NOTHING;

-- Рейтинг тайтла — среднее по отзывам, перенесённые оценки должны в него попасть.
-- Округление то же, что в ReviewService._recalculateRating
UPDATE "titles"
SET "rating" = "stats"."avg", "rating_count" = "stats"."count"
FROM (
    SELECT "title_id", ROUND(AVG("rating"), 2)::DOUBLE PRECISION AS "avg", COUNT(*)::INTEGER AS "count"
    FROM "reviews"
    GROUP BY "title_id"
) AS "stats"
WHERE "stats"."title_id" = "titles"."id"
  AND "titles"."id" IN (SELECT "title_id" FROM "library_entries" WHERE "rating" IS NOT NULL);

-- AlterTable
ALTER TABLE "library_entries" DROP COLUMN "rating";
