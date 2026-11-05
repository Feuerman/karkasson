# Временный режим Firebase без service account

Статус: действует с 2026-11-05 до восстановления доступа к переменным Render.

## Зачем это сделано

После перехода на вход в Firebase по custom token серверу стал обязателен
`FIREBASE_SERVICE_ACCOUNT`. На стенде Render переменную добавить было нельзя:
доступа к панели хостинга нет. Сервер не поднимался, клиент бесконечно
переподключался.

Дополнительно проверка живой базы показала, что закрытые правила уже
задеплоены: запрос `GET /games.json?shallow=true` без авторизации возвращал
`401 Permission denied`. Поэтому одного запуска без service account было
недостаточно.

## Что сейчас включено

- `FIREBASE_API_KEY` и `FIREBASE_DATABASE_URL` не обязательны: по умолчанию
  используются публичные значения проекта, переменные окружения могут их
  переопределить.
- `FIREBASE_SERVICE_ACCOUNT` не обязателен. Если он задан, сервер входит в
  Firebase Auth по custom token; если нет, работает без авторизации.
- `database.rules.json` временно разрешает чтение и запись `games` без
  авторизации. Это позволяет серверу сохранять партии без service account.
- Клиент подключается к серверу только по транспорту WebSocket, без polling.

## Риск

Пока действует этот режим, любой, кто знает адрес Realtime Database и API key,
может читать, изменять и удалять сохранения партий. Это допустимо только как
временная мера. Не оставляй режим включённым после восстановления доступа к
Render.

## Как вернуть закрытый режим

1. В Firebase Console создать ключ сервисного аккаунта: Project settings →
   Service accounts → Generate new private key.
2. Добавить в Render переменную `FIREBASE_SERVICE_ACCOUNT` со всем JSON ключа
   одной строкой.
3. Вернуть закрытые правила из коммита `4f7e4f0`:

   ```sh
   git show 4f7e4f0:database.rules.json > database.rules.json
   ```

4. Задеплоить правила:

   ```sh
   npx firebase-tools deploy --only database --project karkassone-a5080
   ```

5. Проверить, что прямой запрос без авторизации снова получает `401`:

   ```sh
   curl "https://karkassone-a5080-default-rtdb.firebaseio.com/games.json?shallow=true"
   ```

6. Перезапустить сервер и убедиться, что он загружает сохранённые партии.

## Если правила должны оставаться закрытыми

Временная альтернатива — не открывать базу, а перевести production-сервер на
in-memory хранилище. Клиенты смогут подключаться и играть, но партии не
переживут перезапуск сервера. Этот вариант требует отдельной доработки
`server/src/index.ts`.

## Проверки

- `pnpm --filter server run build`
- `pnpm exec vitest run --config vitest.integration.config.ts tests/unit/database.test.ts`
- После правки правил — запрос `GET /games.json?shallow=true`: `401` в закрытом
  режиме, данные или `null` в открытом.

## Связанные файлы

- `server/src/config.ts` — значения Firebase по умолчанию и необязательный
  service account.
- `server/src/modules/Database.ts` — вход в Firebase только при наличии
  service account.
- `database.rules.json` — текущие временно открытые правила.
- `database.rules.json` из `4f7e4f0` — эталон закрытых правил.
- `src/modules/GameService.ts` — подключение клиента только по WebSocket.
