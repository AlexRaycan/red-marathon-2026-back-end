# Как получить ключи для внешних API

Все ключи бесплатные. Регистрация занимает 5–10 минут на сервис.
Готовые ключи вставь в файл `.env` (скопируй его из `.env.example`).

Без ключей бэкенд **запустится**, но живой поиск по соответствующему типу
контента работать не будет.

---

## 1. TMDB — фильмы и сериалы

Самый важный ключ, без него не будет фильмов и сериалов.

1. Зарегистрируйся на https://www.themoviedb.org/signup
2. Подтверди email (письмо приходит сразу).
3. Зайди в https://www.themoviedb.org/settings/api
4. Нажми **Request an API Key** → выбери **Developer**.
5. Прими условия. В анкете:
   - **Type of Use** — Education / Personal
   - **Application Name** — RED Marathon
   - **Application URL** — можно написать `http://localhost:3000`
   - **Application Summary** — пара предложений на английском, что это учебный
     проект-библиотека фильмов. Строгой проверки нет.
6. Ключ выдаётся мгновенно. Копируй значение **API Key (v3 auth)**.

```env
TMDB_API_KEY="твой ключ"
```

> ⚠️ На странице два ключа: короткий **v3 auth** и длинный **v4 Read Access
> Token**. Нам нужен короткий v3.

---

## 2. RAWG — игры

1. Открой https://rawg.io/apidocs
2. Нажми **Get API Key**, зарегистрируйся.
3. Ключ появится сразу в личном кабинете.

```env
RAWG_API_KEY="твой ключ"
```

Лимит бесплатного тарифа — 20 000 запросов в месяц, для учёбы с запасом.

---

## 3. Google Books — книги

1. Зайди в https://console.cloud.google.com/
2. Создай проект (кнопка сверху слева → **New Project**), назови как хочешь.
3. В поиске сверху найди **Books API** → **Enable**.
4. Слева **APIs & Services → Credentials** → **Create Credentials** → **API key**.
5. Скопируй ключ.

```env
GOOGLE_BOOKS_API_KEY="твой ключ"
```

> Google попросит привязать карту только если превысишь бесплатный лимит —
> для учебного проекта это не понадобится.

---

## 4. OpenRouter — AI-рекомендации

Мы используем OpenRouter, а не OpenAI напрямую: он даёт доступ к разным
моделям через один API и работает без VPN.

1. Зарегистрируйся на https://openrouter.ai/
2. Открой https://openrouter.ai/keys
3. **Create Key** → скопируй значение (оно показывается один раз).

```env
OPENROUTER_API_KEY="твой ключ"
```

**Про деньги. Нужен положительный баланс.**

В проекте стоит Claude Haiku 5.5 (`anthropic/claude-haiku-5.5`) — платная
модель, но очень дешёвая: примерно $0.10 за миллион входных и $0.50 за миллион
выходных токенов. Один запрос — это доли цента, разового пополнения на $5
хватит надолго: https://openrouter.ai/credits

Без ключа (или с нулевым балансом) приложение запускается, но AI-ручки
отвечают ошибкой 503 — всё остальное работает.

Расход токенов на каждый вызов пишется в лог (`tokens in=… out=…`),
по нему можно посчитать реальную стоимость.

Модель задаётся в `src/constants/ai.constants.ts` одной строкой, код менять
не нужно. Список моделей и цены: https://openrouter.ai/models

---

## Аниме

Отдельный ключ не нужен — Shikimori отдаёт публичный API без регистрации.

---

## Проверка

После заполнения `.env` запусти бэкенд:

```bash
pnpm start:dev
```

Открой http://localhost:4000/api/docs и попробуй любой эндпоинт поиска.
Если данные приходят — ключи подхватились.

---

## 5. Apple и Google Play — только для оплаты

**Эти ключи нужны не всем.** Без них работает всё, кроме подтверждения
покупок: подписку можно тестировать через пробный период
(`POST /subscription/trial`).

Настраивать их имеет смысл, только когда дойдёшь до публикации в сторы.
Оплата у нас работает **исключительно внутри мобильного приложения** —
ни на сайте, ни в расширении купить нельзя, так требуют правила Apple.

### Apple (App Store Connect)

Нужен платный аккаунт разработчика ($99/год).

1. Зайди в https://appstoreconnect.apple.com/access/integrations/api
2. Вкладка **In-App Purchase** → создай ключ.
3. Скачай файл `.p8` — он даётся **один раз**, сохрани.
4. Скопируй **Key ID** и **Issuer ID** со страницы.

```env
APPLE_KEY_ID="ABC123DEFG"
APPLE_ISSUER_ID="12345678-1234-1234-1234-123456789012"
APPLE_BUNDLE_ID="com.yourcompany.redmarathon"
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
APPLE_ENVIRONMENT="sandbox"
```

> Содержимое `.p8` вставляй одной строкой, заменив переносы на `\n`.
> Пока не вышел в прод, оставляй `APPLE_ENVIRONMENT="sandbox"`.

Вебхуки: в App Store Connect → **App Information → App Store Server
Notifications** укажи `https://твой-домен/webhook/apple` (версия V2).

### Google Play

1. Открой https://console.cloud.google.com/ и выбери проект своего приложения.
2. **IAM & Admin → Service Accounts** → создай сервисный аккаунт.
3. Создай для него ключ формата **JSON** и скачай.
4. В https://play.google.com/console → **Users and permissions** → добавь
   этот сервисный аккаунт и дай права на финансовые данные.

```env
GOOGLE_PLAY_PACKAGE_NAME="com.yourcompany.redmarathon"
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"..."}'
```

> Весь JSON-файл вставляется в переменную одной строкой в одинарных кавычках.

Вебхуки: Play Console → **Monetization setup → Real-time developer
notifications**, создай тему в Pub/Sub и направь её на
`https://твой-домен/webhook/google`.

> Локально вебхуки не сработают — сторам нужен публичный HTTPS-адрес.
> Для проверки используй ngrok или проверяй уже после деплоя.
