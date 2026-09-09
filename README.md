# RED Marathōn — Back-end

REST API для проекта марафона: социальная сеть для фильмов, сериалов, аниме,
книг и игр.

Один бэкенд обслуживает все три клиента: мобильное приложение, веб и браузерное
расширение.

**Стек:** NestJS 10 · Prisma 7 · PostgreSQL · TypeScript

---

## Что понадобится

- **Node.js 20+** — https://nodejs.org
- **pnpm** — установить: `npm install -g pnpm`
- **Docker Desktop** — https://www.docker.com/products/docker-desktop
  (нужен только для базы данных, разбираться в Docker не требуется)

---

## Запуск за 5 шагов

### 1. Установить зависимости

```bash
pnpm install
```

### 2. Создать файл настроек (env)

```bash
cp .env.example .env
```

Открой `.env`, впиши любую строку в `JWT_SECRET` и вставь ключи внешних API —
как их получить, написано в [`API_KEYS.md`](./API_KEYS.md). Без ключей бэкенд
запустится, но поиск контента работать не будет.

### 3. Поднять базу данных

Сначала запусти Docker Desktop и дождись, пока иконка кита перестанет мигать.
Без этого следующая команда выдаст ошибку про `docker.sock`.

```bash
docker compose up -d
```

База поднимется в контейнере на порту 5433. Ставить Postgres на компьютер
не нужно.

Проверить, что база поднялась:

```bash
docker compose ps
```

### 4. Создать таблицы

```bash
pnpm prisma:migrate --name init
```

### 5. Запустить сервер

```bash
pnpm start:dev
```

Готово. Бэкенд работает на http://localhost:4000

---

## Документация API

Swagger со списком всех эндпоинтов:

**http://localhost:4000/api/docs**

Там можно посмотреть, что принимает и что возвращает каждый эндпоинт, и сразу
подёргать их прямо из браузера.

---

## Автогенерация типов и хуков для фронта

В корне лежит `openapi.json` — описание всего API. Из него генерируются
TypeScript-типы и готовые хуки TanStack Query, руками их писать не нужно.

Как это подключить на фронте, разбираем на уроках.

Если API обновился, пересобрать схему можно так:

```bash
pnpm openapi:json
```

---

## Полезные команды

```bash
pnpm start:dev            # сервер с автоперезапуском
pnpm build                # сборка
pnpm start:prod           # запуск собранной версии

pnpm prisma:migrate       # применить миграции
pnpm prisma:studio        # просмотр базы в браузере
pnpm db:seed              # заполнить базу тестовыми данными

pnpm openapi:json         # пересобрать openapi.json

docker compose up -d      # поднять базу
docker compose down       # остановить базу
docker compose down -v    # остановить и УДАЛИТЬ все данные
```

---

## Если что-то не работает

**`failed to connect to the docker API at unix:///...docker.sock`**
Не запущен Docker Desktop. Открой приложение, дождись, пока кит перестанет
мигать, и повтори команду.

**`P1010: User was denied access on the database`**
В `.env` чужие логин и база. Скопируй файл заново: `cp .env.example .env`

**`Can't reach database server at localhost:5433`**
База не поднята — выполни `docker compose up -d`.

**Миграция прошла, но таблиц в базе нет**
Порт 5433 занят другим PostgreSQL, и данные ушли в него. Проверь:
`lsof -i :5433`. Поменяй порт в `docker-compose.yml` и в `DATABASE_URL`.

**Prisma ругается на неизвестные модели**
Начиная с Prisma 7 миграция не генерирует клиент сама. Выполни
`pnpm prisma generate`.

**Поиск контента возвращает пусто**
Не заполнены ключи внешних API — смотри [`API_KEYS.md`](./API_KEYS.md).
