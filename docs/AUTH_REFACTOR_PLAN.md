# План доработки авторизации (вход через Google)

## Текущее состояние

- Клиент: кнопка «Войти через Google» в `GameLobby.vue` и `SettingsPanel.vue` вызывает `signInWithPopup` (Firebase Auth) и шлёт `LinkAccount { userId, idToken }` на сервер через `GameService.linkAccount()`.
- Сервер: привязывает `userId` к Socket.IO-сессии в памяти (`userSessions.ts`), но **не верифицирует подпись `idToken`** — принимает `userId` на доверие.
- Нет события `Logout`, нет кнопки «Выйти», нет авто-восстановления сессии, нет роутера/auth guard, нет страницы профиля.

## Цель

Полная авторизация: верификация `idToken` сервером через Firebase Admin SDK, устойчивые сессии (переживают перезапуск), вход/выход, профиль пользователя, защита игровых действий проверкой владения сессией.

## Этапы реализации

### Этап 0 — Инфраструктура (выполняете вы)

1. Включить провайдер Google в Firebase Console → Authentication → Sign-in method.
2. Добавить авторизованные домены (localhost и продакшен-домен) в Firebase Console → Authentication → Settings.
3. Создать ключ сервисного аккаунта Firebase Admin (JSON) в Firebase Console → Project settings → Service accounts.
4. Добавить `FIREBASE_SERVICE_ACCOUNT` (путь к JSON или содержимое) в `server/.env`.
5. Добавить `FIREBASE_DATABASE_URL` в `server/.env` (если отсутствует).
6. Проверить `CLIENT_ORIGIN` для продакшена в `server/.env`.
7. (Опционально) Поднять Redis для хранения привязок сессий между перезапусками/инстансами.

### Этап 1 — Сервер: верификация ID token и безопасность (код)

- Подключить `firebase-admin` в сервере, инициализировать Admin SDK из `FIREBASE_SERVICE_ACCOUNT`.
- Добавить функцию `verifyIdToken(idToken): Promise<{ uid, email?, name?, picture? }>`.
- В хендлере `LinkAccount`: требовать `idToken`, верифицировать через Admin SDK, извлекать реальный `userId`, привязывать к сессии.
- Добавить событие `Logout`/`UnlinkAccount`: отвязка сессии от пользователя, очистка `userSessions`.
- Добавить проверку сессии в `RegisterSession` и при игровых командах (владелец сессии = владелец действия).
- Обновить валидацию в `server/src/socket/validation.ts` (`LogoutRequest`, `LinkAccountRequest` с `idToken`).

### Этап 2 — Сервер: устойчивость сессий

- Перенести `userSessions` из чистой in-memory карты в постоянное хранилище (Redis или файл/БД), чтобы привязки переживали перезапуск.
- При реконнекте сокета восстанавливать привязку `userId ↔ sessionId`.
- Очистка сессий при `disconnect` клиента.

### Этап 3 — Клиент: поток входа и сессий

- Инициализировать Firebase Auth при загрузке приложения (не лениво по клику).
- Добавить `onAuthStateChanged` для отслеживания состояния авторизации.
- Переработать `GameService.linkAccount()`: слать `idToken` серверу, сохранять `userId` + сессионный токен.
- Добавить `GameService.restoreSession()`: при загрузке страницы отправлятьStored токен серверу, восстанавливать `userId`.
- Добавить `GameService.logout()`: Firebase `signOut`, серверное `Logout`, очистка `localStorage`, сброс UI.
- Добавить ключи локализации в `utils/i18n.ts` (профиль, logout, ошибки auth).

### Этап 4 — Клиент: UI профиля и защита

- После входа заменять кнопку входа на профиль: аватар Google, имя, email, кнопка «Выйти».
- Синхронизировать имя игрока в лобби с именем из Google-профиля (опционально, с возможностью редактировать).
- Страница/раздел профиля (в `SettingsPanel` или отдельный компонент).
- Auth guard: проверка авторизации перед созданием/присоединением к игре (флагами в `App.vue`, роутера нет).
- Переход к лобби после успешного входа.

### Этап 5 — Проверки

- `pnpm run type-check` — типы клиента.
- `pnpm --filter server run build` — компиляция сервера (`tsc`).
- `pnpm test` — полный набор Vitest (unit + integration).
- `pnpm run lint` — ESLint.
- `pnpm run build` — production-сборка клиента.
- Ручное тестирование: вход через Google, отображение профиля, выход, реконнект, перезапуск сервера (восстановление сессии).

## Порядок заливки изменений

1. `git fetch origin` — обновить локальный `main`.
2. Создать отдельную ветку от `origin/main` (`feat/auth-...`).
3. Внести изменения в эту ветку.
4. `git add -A` и закоммитить (сообщение на русском с префиксом области, например `Server: ...`).
5. Запушить ветку в `origin`.
6. Создать pull request в `main`. В `main` ничего не делать напрямую.

## Финальные проверки (стандартный набор)

`pnpm run check:all` — форматирование и полный набор проверок.
