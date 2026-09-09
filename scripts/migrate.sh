#!/bin/sh
# Начиная с Prisma 7 `migrate dev` не генерирует клиент — делаем это сами.
# Отдельный файл, а не цепочка в package.json: там аргументы (--name)
# приклеиваются в конец всей строки и попадают не в ту команду.
set -e

pnpm exec prisma migrate dev "$@"
pnpm exec prisma generate
