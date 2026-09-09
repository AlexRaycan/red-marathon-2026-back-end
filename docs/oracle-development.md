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

После успешного первого запуска можно включить Auto Deploy. Тогда обычный
процесс выглядит так:

```text
изменение в codex/oracle-dev-runtime
→ commit
→ git push
→ Dokploy пересобирает API
→ миграции применяются
→ API снова доступен через тот же SSH-туннель
```

Если меняется схема Prisma, перед push сначала сделай резервную копию базы.
Откат Git-коммита не отменяет уже применённую миграцию.

## 9. Как принять новую версию автора и сохранить наши изменения

Сначала убедись, что текущая работа закоммичена:

```powershell
git status
```

Затем обнови чистую линию автора:

```powershell
git switch main
```

Замени содержимое проекта новой версией автора, но не удаляй папку `.git`.
Проверь изменения и создай отдельный снимок версии автора:

```powershell
git status
git add -A
git commit -m "chore: import backend update from marathon"
```

Перед rebase создай страховочную ветку. В имени подставь текущую дату:

```powershell
git branch backup/oracle-dev-runtime-before-rebase-YYYY-MM-DD codex/oracle-dev-runtime
```

Вернись в нашу ветку и перенеси её коммиты поверх новой версии автора:

```powershell
git switch codex/oracle-dev-runtime
git rebase main
```

Если конфликтов нет, проверь сборку и отправь обновлённую ветку:

```powershell
pnpm install --frozen-lockfile
pnpm build
git push --force-with-lease origin codex/oracle-dev-runtime
```

После rebase обычный `git push` не подходит, потому что история ветки изменилась.
`--force-with-lease` безопаснее обычного `--force`: он откажется перезаписывать
неожиданные чужие изменения.

Если rebase сообщил конфликт, не выбирай всё содержимое одной стороны вслепую.
Остановись и разбери конкретные файлы. Полностью отменить незавершённый rebase:

```powershell
git rebase --abort
```

Страховочная ветка останется на прежнем рабочем состоянии.

## 10. Как откатить наши текущие незакоммиченные изменения

До твоего коммита исходное состояние остаётся в `main` на коммите `362f013`.
Сначала всегда посмотри, что будет удалено:

```powershell
git status
git diff
```

Не выполняй команды очистки автоматически: среди незакоммиченных файлов могут
оказаться твои изменения. Самый безопасный способ сравнения — переключиться на
`main` только после того, как нужная работа сохранена коммитом или stash.

## Официальная документация

- Dokploy Docker Compose: https://docs.dokploy.com/docs/core/docker-compose
- Публикация порта только на loopback: https://docs.docker.com/get-started/docker-concepts/running-containers/publishing-ports/
- Локальный SSH port forwarding (`-L`): https://man.openbsd.org/ssh#L
