# Запуск backend для разработки на Oracle через Dokploy и SSH

Эта схема предназначена только для разработки:

```text
PostgreSQL и NestJS на Oracle
          |
          | порт API доступен только как 127.0.0.1:14000 на Oracle
          |
       SSH-туннель
          |
http://localhost:4000 на ноутбуке
```

PostgreSQL не публикует порт вообще. API не добавляется в Cloudflare и не
подключается к `dokploy-network`. Без действующего SSH-подключения API снаружи
недоступен.

## 1. Как устроены ветки

- `main` хранит очередную исходную версию backend от автора марафона.
- `codex/oracle-dev-runtime` хранит только наши файлы запуска на Oracle.
- Dokploy разворачивает ветку `codex/oracle-dev-runtime`.

Перед первым push наши изменения нужно закоммитить самостоятельно:

```powershell
git status
git add Dockerfile .dockerignore compose.dokploy.yml dokploy.env.example pnpm-workspace.yaml docs/oracle-development.md
git commit -m "chore: add Oracle development runtime"
git push -u origin codex/oracle-dev-runtime
```

Файл `.env` добавлять нельзя: он содержит секреты и уже исключён через
`.gitignore`.

## 2. Подготовить секреты на ноутбуке

Открой PowerShell и два раза выполни команду:

```powershell
$bytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLowerInvariant()
```

Первый результат будет `POSTGRES_PASSWORD`, второй — `JWT_SECRET`. Это две
разные строки по 64 символа. Сохрани их во временном менеджере паролей. В чат,
Git и файлы репозитория их вставлять не нужно.

Пароль PostgreSQL здесь специально состоит только из шестнадцатеричных
символов: его можно безопасно поместить внутрь `DATABASE_URL` без дополнительного
URL-кодирования.

## 3. Создать Compose-сервис в Dokploy

1. Открой существующую панель Dokploy.
2. Создай проект `red-marathon`.
3. В проекте создай окружение `development`.
4. Нажми `Create Service` → `Compose`.
5. Укажи имя `backend`.
6. Выбери тип `Docker Compose`, не `Stack`.
7. В качестве источника выбери GitHub и приватный репозиторий backend.
8. Укажи ветку `codex/oracle-dev-runtime`.
9. В поле Compose Path укажи `./compose.dokploy.yml`.
10. Сохрани настройки. Auto Deploy пока оставь выключенным.
11. Если в интерфейсе есть `Isolated Deployments`, для этого Compose оставь
    опцию выключенной: Compose уже создаёт свою закрытую сеть проекта, а домен и
    общая сеть Traefik этому dev-сервису не нужны.

Не создавай Domain и не добавляй сервис к `dokploy-network`: на этом этапе
доступ к API будет только через SSH.

## 4. Добавить переменные окружения в Dokploy

Открой у Compose-сервиса вкладку `Environment` и добавь:

```dotenv
POSTGRES_USER=red_marathon
POSTGRES_PASSWORD=ВСТАВЬ_ПЕРВЫЙ_СГЕНЕРИРОВАННЫЙ_СЕКРЕТ
POSTGRES_DB=red_marathon
JWT_SECRET=ВСТАВЬ_ВТОРОЙ_СГЕНЕРИРОВАННЫЙ_СЕКРЕТ
API_HOST_PORT=14000
```

Ключи из `dokploy.env.example` добавляй только для тех внешних сервисов,
которые собираешься проверять. Без них сам backend и авторизация запускаются,
но поиск фильмов, игр, книг и AI-функции могут быть недоступны.

Dokploy сохраняет эти значения в своём `.env`. `compose.dokploy.yml` явно
передаёт контейнеру только перечисленные переменные.

## 5. Первый запуск PostgreSQL и API

1. Нажми `Deploy` у Compose-сервиса.
2. Открой `Deployments` и дождись успешной сборки образа.
3. Открой `Logs` сервиса `postgres`. Должно появиться сообщение о готовности
   принимать подключения.
4. Открой `Logs` сервиса `api`.

При каждом запуске контейнер API сначала выполняет:

```text
prisma migrate deploy
```

Команда применяет только ещё не применённые миграции из `prisma/migrations`, а
затем запускается собранный NestJS. На первом старте создаются таблицы. Повторный
запуск не создаёт их заново и не удаляет данные.

В `Monitoring` оба сервиса должны стать healthy. Данные PostgreSQL находятся в
именованном Docker volume `postgres-data` и сохраняются при пересборке
контейнеров.

Образы зафиксированы как `node:22.23.2-bookworm-slim` и
`postgres:17.11-alpine`; оба официальных образа поддерживают архитектуру
Oracle `linux/arm64/v8`.

Никогда не используй `docker compose down -v` и не удаляй volume из Dokploy,
если данные нужны: суффикс `-v` удаляет базу.

## 6. Открыть SSH-туннель с ноутбука

На ноутбуке открой отдельное окно PowerShell и выполни:

```powershell
ssh -N -T `
  -o ExitOnForwardFailure=yes `
  -o ServerAliveInterval=30 `
  -o ServerAliveCountMax=3 `
  -L 127.0.0.1:4000:127.0.0.1:14000 `
  oracle_arm
```

Что означает команда:

- первый `127.0.0.1:4000` — адрес на ноутбуке;
- второй `127.0.0.1:14000` — закрытый порт API на Oracle;
- `oracle_arm` — существующий SSH alias сервера;
- `-N -T` — не открывать удалённую консоль, а держать только туннель;
- `ExitOnForwardFailure` — сразу показать ошибку, если порт открыть не удалось.

Пока команда работает, окно почти ничего не выводит — это нормально. Не
закрывай его. Остановить туннель можно сочетанием `Ctrl+C`.

Если локальный порт 4000 уже занят, замени только левую часть, например:

```powershell
ssh -N -T -o ExitOnForwardFailure=yes -L 127.0.0.1:4001:127.0.0.1:14000 oracle_arm
```

Тогда адрес API на ноутбуке будет `http://localhost:4001`.

## 7. Проверить работу с ноутбука

Не закрывая окно с туннелем, открой второе окно PowerShell:

```powershell
curl.exe --fail http://127.0.0.1:4000/api/docs -o NUL
```

Если команда завершилась без ошибки, открой в браузере:

```text
http://localhost:4000/api/docs
```

Это Swagger со списком методов API. В настройке frontend укажи базовый адрес:

```text
http://localhost:4000
```

Web frontend открывай именно как `http://localhost:3000`, а Expo web — как
`http://localhost:8081`: эти два origin сейчас разрешены в backend. Не заменяй
`localhost` на `127.0.0.1` в браузерной конфигурации — это другой origin и
другой cookie-site. Такое различие может сломать CORS или refresh-cookie даже
при работающем туннеле.

Физический телефон не сможет использовать этот адрес: на телефоне `localhost`
означает сам телефон. Для проверки на физическом устройстве позже потребуется
отдельный HTTPS dev-адрес либо дополнительная схема доступа.

## 8. Обычная работа и обновление через push

После успешного первого запуска можно включить Auto Deploy. Постоянная ветка
для Dokploy — `feature/oracle-dev-runtime`; её опубликованную историю не
переписывай через rebase или force push. Обычный процесс:

```text
изменение в feature/oracle-dev-runtime
→ commit
→ git push
→ Dokploy пересобирает API
→ миграции применяются
→ API снова доступен через тот же SSH-туннель
```

Храни проверенные рабочие версии как аннотированные Git-теги вида
`deploy/ГГГГ-ММ-ДД-номер`. Перед обновлением узнай из истории Deployments,
какой коммит действительно запущен, проверь его через SSH-туннель и пометь
тегом. После обновления и проверки пометь новым тегом новый работающий коммит.
Теги отправляй в GitHub отдельно, чтобы точки отката не зависели от ноутбука.
Не называй локальный HEAD рабочей версией без проверки Dokploy.

Тег хранит код, но не состояние PostgreSQL. Перед каждым обновлением сохрани
резервную копию базы вне её Docker volume. Если меняется схема Prisma, это
особенно важно: откат Git-коммита не отменяет применённую миграцию.

## 9. Обновление от автора: версия 3

Архив версии 3 сохранён отдельным коммитом в `main` — это чистая линия
версий автора. Постоянная ветка `feature/oracle-dev-runtime` содержит наши
настройки Docker, Dokploy и OpenRouter; версия 3 влита в неё через merge.
Dokploy уже настроен на эту ветку и файл `./compose.dokploy.yml`.

У версии 3 появились маршруты `/discover/trending` и `/discover/:key`,
получение трендов из внешних каталогов и команда локального запуска БД.
Схема Prisma и миграции относительно исходного `main` не менялись.

При включённом Autodeploy с Trigger Type `On Push` отправка коммитов в
`feature/oracle-dev-runtime` сама запускает Deploy. Сначала проверь настройки,
тег последней проверенной версии и резервную копию данных; не нажимай
`Fresh Volumes`. После запуска проверь логи `postgres` и `api`, статус
healthcheck и через SSH-туннель адреса `/api/docs` и `/discover/trending`.
Последний маршрут зависит от доступности внешних API и их ключей.

Для следующих архивов автора сохраняй обновление отдельным коммитом в `main`,
затем вливай `main` в `feature/oracle-dev-runtime` и разрешай конфликты.
Сначала сравни схемы и миграции. Если они изменились, сделай резервную копию
PostgreSQL до push ветки развёртывания: откат кода не отменяет миграции базы.

## 10. Возврат к проверенной версии

Последняя рабочая версия до обновления, подтверждённая владельцем проекта, —
коммит `0a9e444`. На него поставлен тег `deploy/2026-09-28-pre-v3`.
Перед обновлением сохрани этот тег в GitHub вместе с резервной копией базы.

Если новый Deploy не проходит проверку, верни файлы из последнего рабочего
тега новым коммитом в той же ветке. Начинай только с чистой рабочей копии:

```powershell
git switch feature/oracle-dev-runtime
git status --short
git restore --source=deploy/2026-09-28-pre-v3 --staged --worktree -- .
git diff --cached --stat
git commit -m "rollback to last working release"
git push origin feature/oracle-dev-runtime
```

Перед `commit` просмотри изменения; push с включённым Autodeploy запустит
повторный Deploy. История Git и теги сохранятся. База PostgreSQL останется в
volume; не удаляй его. Если новая версия успела изменить схему или данные,
откат кода отдельно не восстановит их — используй заранее подготовленный
план восстановления базы.

## Официальная документация

- Dokploy Docker Compose: https://docs.dokploy.com/docs/core/docker-compose
- Публикация порта только на loopback: https://docs.docker.com/get-started/docker-concepts/running-containers/publishing-ports/
- Локальный SSH port forwarding (`-L`): https://man.openbsd.org/ssh#L
