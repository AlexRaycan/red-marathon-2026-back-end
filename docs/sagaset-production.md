# Sagaset в Dokploy

## Цель и ограничения

- Публичный API — https://sagaset-api.alexraycan.com. Для будущего веб-клиента предусмотрен origin `https://sagaset.alexraycan.com`.
- Сервис `Sagaset` находится в `red-marathon → production`. PostgreSQL получает собственный том `postgres-data` в отдельном Compose-проекте. Начальная база пустая.
- `development` разворачивается со своей ветки, использует свою базу и сохраняет SSH-доступ.

## Как устроен деплой

- Источник — ветка `production` приватного репозитория бэкенда, файл `./compose.production.yml`, тип Docker Compose. Продакшен обновляется вручную после проверки изменений в development.
- Уже настроенный маршрут `*.alexraycan.com` ведёт через Cloudflare Tunnel в Dokploy. Домен в Dokploy направляет запросы на сервис `api`, контейнерный порт `4000`, внутренний HTTP. TLS для клиента завершает Cloudflare. Порты API и PostgreSQL на хосте не публикуются.
- Для релиза используются образы Node и PostgreSQL с версионными тегами и поддержкой `linux/arm64`. Докер-образ API Dokploy собирает из выбранного коммита.
- Файлы `api.env` и `postgres.env` хранятся с правами `600` в `/home/ubuntu/apps/dokploy/config/sagaset-production/` на Oracle. В контейнере Dokploy этот каталог доступен как `/etc/dokploy/sagaset-production/`. Секрет JWT и пароль базы сгенерированы отдельно от development. Параметры подключённых интеграций задаются в `api.env`.
- Продакшен принимает браузерные запросы с credentials для указанного origin, устанавливает `Secure` на refresh-cookie и ограничивает запросы входа и регистрации по IP. Доверие к `CF-Connecting-IP` включено для текущей схемы с единственным внешним входом через Cloudflare. Авторизация расширения по короткому коду временно включена. Отдельный секрет для получения токенов требует согласованного обновления бэкенда и расширения.

## Проверка и обновление

1. Проверь изменения в development, затем обнови ветку `production`. Проверь, что в Compose отсутствуют публикации портов и сохранены имя сервиса `postgres` и том `postgres-data`.
2. Сохрани дамп production до миграции и проверь каталог дампа. После развёртывания проверь статус контейнеров, миграции и ручки `/health`, `/api/docs-json`, `/users/me`. Последняя без токена должна отвечать `401`.
3. Если релиз не прошёл проверки, верни предыдущий рабочий коммит новым коммитом в `production` и запусти Deploy. При изменении схемы сначала проверь совместимость кода с миграциями. Восстановление дампа заменяет записи, появившиеся после резервного копирования.

Проверить Compose без вывода значений секретов можно из контейнера Dokploy в каталоге исходников сервиса:

```sh
docker compose -f compose.production.yml config --quiet
```

Для резервной копии войди на Oracle командой `ssh oracle_arm`. Подставь имя контейнера PostgreSQL из production-сервиса в Dokploy.

```sh
umask 077
install -d -m 700 "$HOME/backups/sagaset"
db_container='имя-контейнера-PostgreSQL'
dump="$HOME/backups/sagaset/$(date -u +%Y%m%dT%H%M%SZ).dump"
docker exec "$db_container" sh -c 'pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$dump" &&
  docker exec -i "$db_container" pg_restore --list < "$dump" > /dev/null
```
