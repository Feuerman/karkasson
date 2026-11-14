import { ref, type Ref } from 'vue'
import { CommonErrors, LobbyErrors, GameErrors } from '@server/modules/errors'

const LOCALE_STORAGE_KEY = 'locale'
const DEFAULT_LOCALE: Locale = 'ru'
const FALLBACK_LOCALE: Locale = 'en'

export type Locale = 'ru' | 'en'

export const availableLocales: Locale[] = ['ru', 'en']

type Messages = Record<string, string>

const messages: Record<Locale, Messages> = {
  ru: {
    ui_your_turn: 'Ваш ход',
    ui_error_generic: 'Произошла ошибка',
    ui_error_games_list: 'Произошла ошибка при получении списка игр',
    ui_error_connection: 'Нет соединения с сервером',
    ui_error_connection_interrupted:
      'Соединение с сервером прервано, попробуйте отправить команду ещё раз',
    ui_error_command_not_delivered:
      'Соединение с сервером прервано, команда не доставлена',
    ui_error_server_timeout: 'Сервер не ответил вовремя. Повторите действие',
    ui_error_session_failed:
      'Не удалось установить сессию. Переподключитесь к серверу',
    ui_error_protocol_mismatch:
      'Требуется перезагрузка страницы: версия протокола клиента и сервера не совпадают',
    ui_error_not_connected: 'Нет соединения с сервером',
    ui_error_leave_game: 'Не удалось покинуть партию',
    ui_error_critical: 'Что-то пошло не так',
    ui_error_reload: 'Перезагрузить страницу',
    ui_confirm_leave_active_game:
      'Партия уже начата. Действительно хотите выйти?',
    ui_error_room_not_found:
      'Комната не найдена. Проверьте код и попробуйте снова',
    ui_error_create_game: 'Не удалось создать игру. Попробуйте снова',
    lobby_retry: 'Повторить',
    ui_game_deleted_stale: 'Партия удалена: все игроки давно отключились',
    ui_game_deleted_owner_left: 'Лобби закрыто: владелец вышел из комнаты',
    ui_game_deleted_expired: 'Срок хранения завершённой партии истёк',
    ui_game_deleted_failed: 'Партия закрыта из-за ошибки сервера',
    ui_session_replaced:
      'Партия открыта в другой вкладке. Здесь управление больше недоступно',
    ui_layout_reset: 'Расположение окон сброшено',
    ui_menu_rules: 'Правила игры',
    ui_menu_result: 'Итоги партии',
    ui_menu: 'Меню',
    ui_menu_language: 'Язык',
    ui_sound_off: 'Выключить звук',
    ui_sound_on: 'Включить звук',
    ui_layout_edit: 'Настроить окна',
    ui_layout_done: 'Готово',
    ui_layout_reset_label: 'Сбросить расположение окон',
    ui_exit_game: 'Выйти из игры',
    ui_language_ru: 'Русский',
    ui_language_en: 'English',
    ui_language_changed: 'Язык изменён',
    ui_just_now: 'только что',
    ui_ago: 'назад',
    ui_yesterday: 'вчера',
    time_minute_one: 'минуту',
    time_minute_two: 'минуты',
    time_minute_five: 'минут',
    time_minute_other: 'minutes',
    time_hour_one: 'час',
    time_hour_two: 'часа',
    time_hour_five: 'часов',
    time_hour_other: 'hours',
    time_day_one: 'день',
    time_day_two: 'дня',
    time_day_five: 'дней',
    time_day_other: 'days',

    // Названия объектов и подписи на доске.
    object_city: 'город',
    object_road: 'дорога',
    object_monastery: 'монастырь',
    object_garden: 'сад',
    object_field: 'поле',
    object_city_genitive: 'города',
    object_road_genitive: 'дороги',
    object_monastery_genitive: 'монастыря',
    object_garden_genitive: 'сада',
    object_field_genitive: 'поля',
    object_road_accusative: 'дорогу',
    object_generic: 'объект',
    object_generic_capitalized: 'Объект',
    direction_north: 'Север',
    direction_south: 'Юг',
    direction_east: 'Восток',
    direction_west: 'Запад',
    direction_center: 'Центр',
    direction_north_lower: 'север',
    direction_south_lower: 'юг',
    direction_east_lower: 'восток',
    direction_west_lower: 'запад',
    quadrant_west_north: 'северо-запад',
    quadrant_east_north: 'северо-восток',
    quadrant_east_south: 'юго-восток',
    quadrant_west_south: 'юго-запад',
    field_whole_tile: 'вокруг всего тайла',
    field_corner: 'угол: {{title}}',
    field_along_side: 'вдоль стороны: {{side}}',
    field_region: '{{title}} (участок {{index}})',
    field_tile: '{{title}} (тайл {{x}}, {{y}})',

    // Общие действия и ошибки.
    action_select_cell_error: 'Не удалось выбрать клетку',
    action_move_dragon_error: 'Не удалось переместить дракона',
    action_rotate_tile_error: 'Не удалось повернуть плитку на сервере',
    action_select_cell_first: 'Сначала выберите клетку для размещения',
    action_place_tile_error: 'Произошла ошибка при размещении плитки',
    action_recall_abbot_error: 'Не удалось отозвать аббата',
    action_place_follower_error: 'Не удалось выставить подданного',
    action_skip_follower_error: 'Не удалось пропустить выставление',
    action_move_fairy_error: 'Не удалось переместить фею',
    action_princess_error: 'Не удалось выполнить действие принцессы',
    notification_error_title: 'Ошибка',

    // Состояние соединения.
    connection_reconnect: 'Переподключиться',
    connection_connected: 'Подключено',
    connection_replaced_label: 'Партия открыта в другой вкладке',
    connection_replaced_details:
      'Управление передано другой вкладке. Здесь можно вернуть его себе.',
    connection_offline_label: 'Нет подключения',
    connection_offline_details:
      'Проверьте подключение к интернету, затем попробуйте снова.',
    connection_connecting_label: 'Подключение…',
    connection_connecting_details: 'Устанавливаем соединение с сервером.',
    connection_first_connect_details:
      'Первое подключение может занять около минуты.',
    connection_server_closed_label: 'Сервер закрыл соединение',
    connection_server_closed_details: 'Переподключаемся к серверу.',
    connection_timeout_label: 'Сервер не отвечает',
    connection_timeout_details: 'Ждём ответа сервера.',
    connection_transport_label: 'Сервер недоступен',
    connection_transport_details: 'Не удалось установить соединение.',
    connection_server_down_label: 'Сервер недоступен',
    connection_server_down_details: 'Сервер временно недоступен.',
    connection_lost_label: 'Нет связи с сервером',
    connection_lost_details: 'Пытаемся восстановить соединение.',
    connection_attempt: 'Попытка {{attempt}}.',
    connection_waiting_players: 'Ожидание подключения игроков',

    // Отзыв аббата.
    abbot_title: 'Отзыв аббата',
    abbot_description:
      'Снять аббата с {{location}} и получить {{points}} {{unit}}.',
    abbot_recall_button: 'Забрать аббата',
    abbot_points_one: 'очко',
    abbot_points_two: 'очка',
    abbot_points_five: 'очков',
    abbot_points_other: 'points',
    abbot_location_monastery: 'монастыря',
    abbot_location_garden: 'сада',

    // Выставление подданных.
    follower_penalty:
      'Принцесса забрала подданного — на этот тайл свою фишку поставить нельзя. Завершите ход.',
    follower_no_options: 'Нет доступных вариантов',
    follower_fairy_hint_placing:
      'Можно переместить фею к своему подданному или завершить ход.',
    follower_fairy_hint_offer:
      'Вместо выставления подданного можно переместить фею.',
    follower_show_tile: 'Показать тайл {{x}}, {{y}}',
    follower_finish_turn: 'Завершить ход',
    follower_skip: 'Пропустить выставление',
    follower_abbot: 'аббат',
    follower_big: 'большой подданный',
    follower_monk: 'монах',
    follower_panel_move_fairy: 'Переместить фею',
    follower_panel_place: 'Поставить подданного',
    follower_portal_choose_tile:
      'Ворота магии: выберите тайл на доске для размещения подданного',
    follower_portal_tile: 'Тайл {{x}}, {{y}}',
    follower_portal_tile_count: '{{count}} вариантов',
    follower_portal_selected: 'Тайл {{x}}, {{y}}',
    follower_label_monk: '{{title}} — монах',
    follower_label_typed: '{{title}} — {{type}}',
    fairy_target_abbot: 'Фея к аббату {{player}}',
    fairy_target_big: 'Фея к большому подданному {{player}}',
    fairy_target_peasant: 'Фея к крестьянину {{player}}',
    fairy_target_follower: 'Фея к подданному {{player}}',
    fairy_target_unknown_player: 'игрока',

    // Принцесса и дракон.
    dragon_panel_title: 'Движение дракона',
    princess_panel_title: 'Принцесса',
    dragon_instructions:
      'Выберите соседний выложенный тайл на игровом поле. Осталось шагов: {{steps}}.',
    princess_instructions:
      'Выберите рыцаря, которого принцесса отгонит из города. Если в городе несколько рыцарей, выбираете вы — в том числе своего.',
    princess_kind_big: 'Большой рыцарь',
    princess_kind: 'Рыцарь',
    princess_label: '{{kind}} — {{player}}',
    princess_unknown_player: 'подданный',

    // Итоги партии.
    result_title: 'Итоги партии',
    result_close_title: 'Закрыть итоги',
    result_close_aria: 'Закрыть итоги партии',
    result_winner: 'Победитель',
    result_to_lobby: 'В лобби',
    result_play_again: 'Сыграть ещё',
    result_finished: 'Партия завершена',
    result_winner_one: 'Победитель: {{name}}',
    result_draw: 'Ничья: {{names}}',
    breakdown_cities: 'Города',
    breakdown_roads: 'Дороги',
    breakdown_monasteries: 'Монастыри',
    breakdown_gardens: 'Сады',
    breakdown_fields: 'Поля',
    breakdown_other: 'Прочие начисления',

    // Сводка хода и история.
    turn_short: 'ход {{number}}',
    turn_hide_summary: 'Скрыть сводку хода',
    turn_hide: 'Скрыть',
    turn_tile: 'Тайл {{id}}',
    turn_go_to_cell: 'Перейти к клетке {{row}}, {{col}}',
    turn_go_to_tile: 'Перейти к плитке на доске',
    turn_follower_on: 'Подданный на {{place}}',
    turn_returned: 'Вернулось подданных: {{count}}',
    turn_dragon_moved: 'Дракон двигался',
    turn_fairy_moved: 'Фея перемещалась',
    turn_princess_took: 'Принцесса забрала подданного',
    turn_you: 'Вы',
    turn_final_scoring: 'Финальный подсчёт',
    turn_your_turn: 'Ваш ход',
    turn_object: 'Объект',
    turn_score_awarded: 'Начислено очков: {{points}}',
    turn_player_fallback: 'Игрок {{id}}',
    turn_player_turn: 'Ход игрока',
    panel_expand: 'Развернуть окно',
    panel_collapse: 'Свернуть окно',
    history_title: 'История ходов',
    history_turn_short: 'ход',
    history_round: 'раунд {{number}}',
    history_expand: 'Развернуть историю',
    history_collapse: 'Свернуть историю',
    history_filter_aria: 'Фильтр истории',
    history_empty: 'Нет действий этого типа',
    history_filter_all: 'Все',
    history_filter_tiles: 'Тайлы',
    history_filter_followers: 'Подданные',
    history_filter_scores: 'Очки',
    history_filter_returns: 'Возвраты',
    history_filter_dragon: 'Дракон',
    history_filter_princess: 'Принцесса',
    history_filter_fairy: 'Фея',
    history_coordinates: 'Строка {{row}}, столбец {{col}}',
    history_final_scoring: 'Финальный подсчёт',
    history_move: 'Ход {{number}}',
    follower_name_robber: 'разбойник',
    follower_name_knight: 'рыцарь',
    follower_name_monk: 'монах',
    follower_name_abbot: 'аббат',
    follower_name_peasant: 'крестьянин',
    follower_name_generic: 'подданный',
    follower_big_hint: '* — большой подданный',
    action_completed_object: 'Завершён объект.',
    action_show_object: 'Показать объект на доске',
    action_points_awarded: 'Начислено очков:',
    action_returned_followers: 'Возврат подданных.',
    action_dragon_moved: 'Дракон переместился.',
    action_from_cell: 'С клетки',
    action_to_cell: 'на клетку',
    action_steps_left: 'Осталось шагов: {{steps}}.',
    action_eaten_followers: 'Съедены подданные:',
    action_fairy_moved: 'Фея переместилась.',
    action_fairy_point: 'Очко феи.',
    action_fairy_receives: 'получает {{points}} {{unit}} за {{kind}}.',
    action_points_one: 'очко',
    action_points_two: 'очка',
    action_points_five: 'очков',
    action_points_other: 'points',
    action_fairy_kind_abbot: 'аббата',
    action_fairy_kind_big: 'большого подданного',
    action_fairy_kind_peasant: 'крестьянина',
    action_fairy_kind_follower: 'подданного',
    action_placed_follower_prefix: 'Выставлен',
    action_on_cell: 'На клетку',
    action_on_object: 'на объект',
    action_object_generic: 'объект',
    action_tile_placed: 'Выложен тайл.',
    action_tile_on_cell: 'Тайл {{id}} на клетку',
    action_princess_took: 'Принцесса забрала подданного.',
    action_city_on_cell: 'Город на клетке',
    action_follower_label: 'Подданный:',

    // Доска.
    board_rotate_ccw: 'Повернуть тайл против часовой стрелки',
    board_rotate_cw: 'Повернуть тайл по часовой стрелке',
    board_dragon: 'Дракон',
    board_cell: 'Клетка {{row}}, {{col}}',
    board_cell_busy: 'Клетка {{row}}, {{col}}, занята',
    board_fairy_unbound: 'Фея, не связана с подданным',
    board_fairy_at_player: 'Фея у подданного игрока {{name}}',
    board_choose_cell: 'Выберите клетку на поле',
    board_keys_hint:
      'Клавиши: R — повернуть, P — разместить, Esc — снять выбор',
    board_place_on_selected: 'Разместить тайл на выбранной клетке',
    board_select_cell_first: 'Сначала выберите клетку на поле',
    board_place: 'Разместить',
    board_zoom_out: 'Отдалить',
    board_zoom_out_aria: 'Отдалить доску',
    board_zoom_reset: 'Сбросить масштаб',
    board_zoom_in: 'Приблизить',
    board_zoom_in_aria: 'Приблизить доску',

    // Лобби.
    lobby_title: 'Каркассон',
    lobby_subtitle: 'Стройте средневековые земли вместе с друзьями',
    lobby_connecting: 'Идёт соединение с сервером...',
    lobby_loading_games: 'Загрузка списка игр...',
    lobby_show_ended: 'Показать оконченные',
    lobby_create_game: 'Создать новую игру',
    lobby_find_room: 'Найти комнату по номеру',
    lobby_room_placeholder: 'Например, 482731',
    lobby_room_not_found: 'Комната не найдена',
    lobby_no_games: 'Нет текущих игр',
    lobby_check_room: 'Проверьте номер комнаты и попробуйте снова',
    lobby_create_or_join:
      'Создайте новую игру или присоединитесь к существующей',
    lobby_room_title: 'Комната № {{code}}',
    lobby_room_subtitle:
      'Займите свободные слоты или оставьте их искусственному интеллекту',
    lobby_players: 'Игроки',
    lobby_free_slots: 'Свободные слоты',
    lobby_leave_room: 'Выйти из комнаты',
    lobby_back_to_list: 'Назад к списку',
    lobby_start_game: 'Начать игру',
    lobby_game_party: 'Партия «{{name}}»',
    lobby_copy_room_code: 'Скопировать номер комнаты',
    lobby_copy_room_code_aria: 'Скопировать номер комнаты {{code}}',
    lobby_room_copied: 'Номер скопирован',
    lobby_copy_room_number: 'Скопировать номер',
    lobby_copied: 'Скопировано',
    lobby_last_game: 'Последняя',
    lobby_updated: 'Обновлено {{time}}',
    lobby_status_round: 'Раунд {{number}}',
    lobby_status_ended: 'Окончена',
    lobby_status_waiting: 'Ожидание игроков',
    lobby_join: 'Войти',
    lobby_continue: 'Продолжить',
    lobby_load: 'Загрузить',
    lobby_spectator: 'Наблюдать',
    lobby_player_placeholder: 'Игрок {{index}}',
    lobby_ai: 'ИИ',
    lobby_release: 'Освободить',
    lobby_take: 'Занять',
    lobby_rule_on: 'вкл',
    lobby_rule_off: 'выкл',
    lobby_create_title: 'Создание игры',
    lobby_create_description: 'Настройте правила новой партии',
    lobby_final_scoring: 'Финальный подсчёт очков',
    lobby_final_scoring_description:
      'Если включить опцию, в конце партии очки начислятся за незавершённые дороги, города, монастыри и сады.',
    lobby_expansions: 'Дополнения',
    expansion_inns: 'Таверны и соборы',
    expansion_river: 'Река',
    expansion_princess: 'Принцесса и дракон',
    expansion_inns_description:
      'Добавляет 18 тайлов дополнения и большого подданного.',
    expansion_river_description:
      'В начале партии выкладывается река от истока до озера, затем идёт обычная колода.',
    expansion_princess_description:
      'Добавляет тайлы с принцессой, драконом и вулканом.',
    lobby_cancel: 'Отмена',
    lobby_create_submit: 'Создать игру',
    lobby_password_placeholder: 'Пароль комнаты',
    lobby_password_label: 'Пароль',
    lobby_private_label: 'Приватная комната',
    lobby_private_description:
      'Комната не попадёт в общий список. Зайти можно только по номеру и паролю.',
    lobby_google_login: 'Войти через Google',
    lobby_google_login_title: 'Вход через Google OAuth',

    lobby_invite: 'Пригласить',
    lobby_invite_link: 'Ссылка на комнату',
    lobby_link_copied: 'Ссылка скопирована',

    // Панель партии.
    stats_draw: 'Ничья',
    stats_leader: 'Лидер по очкам',
    stats_you: 'Вы',
    stats_you_short: 'Вы',
    stats_game_points: 'Очки за партию',
    stats_ordinary_in_supply: '{{count}} подданных в запасе',
    stats_big_in_supply: '{{count}} больших подданных в запасе',
    stats_abbot_in_supply: 'Аббат в запасе',
    stats_abbot_on_board: 'Аббат на поле',
    stats_turn_score: 'Очки за текущий ход: +{{score}}',
    stats_progress: 'Прогресс',
    stats_in_deck: 'В колоде: {{count}}',
    stats_turn: 'Ход',
    stats_current: 'Ходит:',
    stats_thinking: 'думает',
    stats_next: 'Далее:',
    stats_turn_order: 'Очередь ходов',
    stats_player: 'Игрок',
    stats_playing_now: 'Ходит сейчас: {{name}}',
    stats_in_queue: 'В очереди: {{name}}',
    stats_turn_short: 'ход {{number}}',
    stats_ai: 'ИИ',
    phase_dragon_own: 'Выберите, куда шагнуть драконом',
    phase_dragon_other: '{{name}} двигает дракона',
    phase_princess_own: 'Выберите подданного для принцессы',
    phase_princess_other: '{{name}} выбирает подданного',
    phase_follower_own: 'Выставьте подданного или пропустите',
    phase_follower_other: '{{name}} выставляет подданного',
    phase_tile_own: 'Поставьте тайл на поле',
    phase_tile_other: '{{name}} ставит тайл',
    phase_waiting_own: 'Ваш ход',
    phase_waiting_other: '{{name}} готовится к ходу',
    stats_cities: 'города',
    stats_roads: 'дороги',
    stats_monasteries: 'монастыри',
    stats_gardens: 'сады',
    stats_city_one: 'город',
    stats_city_two: 'города',
    stats_city_five: 'городов',
    stats_road_one: 'дорога',
    stats_road_two: 'дороги',
    stats_road_five: 'дорог',
    stats_monastery_one: 'монастырь',
    stats_monastery_two: 'монастыря',
    stats_monastery_five: 'монастырей',
    stats_garden_one: 'сад',
    stats_garden_two: 'сада',
    stats_garden_five: 'садов',
    stats_plural_other_places: 'places',

    // Правила.
    rules_close: 'Закрыть',
    rules_dragon_zero: 'Д',
    rules_follower_returned: 'Подданный возвращён в запас',
    tile_image_alt: 'Тайл {{id}}',
    score_tiles_road: 'Тайлы дороги',
    score_tiles_city: 'Тайлы города',
    score_shields_city: 'Гербы в городе',
    score_tile_monastery: 'Тайл монастыря',
    score_tile_garden: 'Тайл сада',
    score_around_tiles: 'Занятые клетки вокруг',
    score_completed_monastery: 'Завершённый монастырь',
    score_completed_garden: 'Завершённый сад',
    score_fairy_bonus: 'Бонус феи',
    score_field_cities: 'Завершённые города у поля',
    modifier_inn_completed: 'Таверна: 2 очка за каждый тайл дороги',
    modifier_inn_incomplete: 'Таверна: незавершённая дорога приносит 0 очков',
    modifier_cathedral_completed: 'Собор: 3 очка за каждый тайл и герб города',
    modifier_cathedral_incomplete:
      'Собор: незавершённый город приносит 0 очков',
    ui_error_account_link_failed:
      'Не удалось привязать аккаунт. Попробуйте снова',
    ui_error_account_restore_failed:
      'Не удалось восстановить доступ к играм. Попробуйте снова',
    ui_settings: 'Настройки',
    ui_settings_sound: 'Звук',
    ui_settings_animations: 'Анимации',
    ui_settings_notifications: 'Уведомления',
    ui_settings_account: 'Аккаунт',
    ui_settings_close: 'Закрыть',
    ui_onboarding_place_tile_title: 'Первый тайл',
    ui_onboarding_place_tile_hint:
      'Выберите свободную клетку на доске и нажмите «Разместить», чтобы выложить тайл.',
    ui_onboarding_place_follower_title: 'Подданный',
    ui_onboarding_place_follower_hint:
      'После тайла можно выставить подданного на город, дорогу, монастырь или сад.',
    ui_onboarding_move_dragon_title: 'Дракон',
    ui_onboarding_move_dragon_hint:
      'Выберите соседний тайл, куда шагнёт дракон. Каждый шаг съедает подданных на пути.',
    ui_onboarding_princess_title: 'Принцесса',
    ui_onboarding_princess_hint:
      'Принцесса выгоняет рыцаря из города. Выберите, чьего подданного забрать.',
    ui_onboarding_move_fairy_title: 'Фея',
    ui_onboarding_move_fairy_hint:
      'Вместо подданного можно передвинуть фею к своей фишке — она даст очко в конце хода.',
    ui_onboarding_recall_abbot_title: 'Отзыв аббата',
    ui_onboarding_recall_abbot_hint:
      'Заберите аббата с монастыря или сада и получите очки за каждый соседний тайл.',
    ui_onboarding_done: 'Понятно',
    ui_onboarding_skip: 'Пропустить обучение',
    ui_account_title: 'Аккаунт',
    ui_account_signed_in: 'Вы вошли как',
    ui_account_not_linked: 'Аккаунт не привязан',
    ui_account_link_google: 'Привязать аккаунт через Google',
    ui_account_restore: 'Восстановить доступ к играм',
    ui_account_user_id: 'ID пользователя (Firebase Auth)',
    ui_account_restore_button: 'Восстановить',
    ui_account_restored:
      'Доступ восстановлен: {count} активных партий, к которым можно вернуться',
    ui_account_linked: 'Аккаунт привязан',
  },
  en: {
    ui_your_turn: 'Your turn',
    ui_error_generic: 'An error occurred',
    ui_error_games_list: 'Failed to load the games list',
    ui_error_connection: 'No connection to the server',
    ui_error_connection_interrupted:
      'Connection to the server was interrupted. Try sending the command again',
    ui_error_command_not_delivered:
      'Connection to the server was interrupted, the command was not delivered',
    ui_error_server_timeout: 'The server did not respond in time. Try again',
    ui_error_session_failed:
      'Failed to establish session. Reconnect to the server',
    ui_error_protocol_mismatch:
      'Page reload required: client and server protocol versions do not match',
    ui_error_not_connected: 'No connection to the server',
    ui_error_leave_game: 'Failed to leave the game',
    ui_error_critical: 'Something went wrong',
    ui_error_reload: 'Reload page',
    ui_confirm_leave_active_game:
      'The game has already started. Are you sure you want to leave?',
    ui_error_room_not_found: 'Room not found. Check the code and try again',
    ui_error_create_game: 'Failed to create the game. Try again',
    lobby_retry: 'Try again',
    ui_game_deleted_stale: 'Game removed: all players disconnected long ago',
    ui_game_deleted_owner_left: 'Lobby closed: the owner left the room',
    ui_game_deleted_expired: 'Storage period for the finished game has expired',
    ui_game_deleted_failed: 'Game closed due to a server error',
    ui_session_replaced:
      'The game is open in another tab. Control is no longer available here',
    ui_layout_reset: 'Window layout reset',
    ui_menu_rules: 'Game rules',
    ui_menu_result: 'Game results',
    ui_menu: 'Menu',
    ui_menu_language: 'Language',
    ui_sound_off: 'Turn off sound',
    ui_sound_on: 'Turn on sound',
    ui_layout_edit: 'Adjust windows',
    ui_layout_done: 'Done',
    ui_layout_reset_label: 'Reset window layout',
    ui_exit_game: 'Exit game',
    ui_language_ru: 'Russian',
    ui_language_en: 'English',
    ui_language_changed: 'Language changed',
    ui_just_now: 'just now',
    ui_ago: 'ago',
    ui_yesterday: 'yesterday',
    time_minute_one: 'minute',
    time_minute_two: 'minutes',
    time_minute_five: 'minutes',
    time_minute_other: 'minutes',
    time_hour_one: 'hour',
    time_hour_two: 'hours',
    time_hour_five: 'hours',
    time_hour_other: 'hours',
    time_day_one: 'day',
    time_day_two: 'days',
    time_day_five: 'days',
    time_day_other: 'days',

    object_city: 'city',
    object_road: 'road',
    object_monastery: 'monastery',
    object_garden: 'garden',
    object_field: 'field',
    object_city_genitive: 'city',
    object_road_genitive: 'road',
    object_monastery_genitive: 'monastery',
    object_garden_genitive: 'garden',
    object_field_genitive: 'field',
    object_road_accusative: 'road',
    object_generic: 'feature',
    object_generic_capitalized: 'Feature',
    direction_north: 'North',
    direction_south: 'South',
    direction_east: 'East',
    direction_west: 'West',
    direction_center: 'Center',
    direction_north_lower: 'north',
    direction_south_lower: 'south',
    direction_east_lower: 'east',
    direction_west_lower: 'west',
    quadrant_west_north: 'north-west',
    quadrant_east_north: 'north-east',
    quadrant_east_south: 'south-east',
    quadrant_west_south: 'south-west',
    field_whole_tile: 'around the whole tile',
    field_corner: 'corner: {{title}}',
    field_along_side: 'along the side: {{side}}',
    field_region: '{{title}} (area {{index}})',
    field_tile: '{{title}} (tile {{x}}, {{y}})',

    action_select_cell_error: 'Failed to select a cell',
    action_move_dragon_error: 'Failed to move the dragon',
    action_rotate_tile_error: 'Failed to rotate the tile on the server',
    action_select_cell_first: 'Select a cell for placement first',
    action_place_tile_error: 'Failed to place the tile',
    action_recall_abbot_error: 'Failed to recall the abbot',
    action_place_follower_error: 'Failed to place the follower',
    action_skip_follower_error: 'Failed to skip the placement',
    action_move_fairy_error: 'Failed to move the fairy',
    action_princess_error: 'Failed to perform the princess action',
    notification_error_title: 'Error',

    connection_reconnect: 'Reconnect',
    connection_connected: 'Connected',
    connection_replaced_label: 'The game is open in another tab',
    connection_replaced_details:
      'Control was passed to another tab. You can take it back here.',
    connection_offline_label: 'No connection',
    connection_offline_details:
      'Check your internet connection, then try again.',
    connection_connecting_label: 'Connecting…',
    connection_connecting_details: 'Establishing a connection to the server.',
    connection_first_connect_details:
      'First connection may take about a minute.',
    connection_server_closed_label: 'The server closed the connection',
    connection_server_closed_details: 'Reconnecting to the server.',
    connection_timeout_label: 'The server is not responding',
    connection_timeout_details: 'Waiting for the server response.',
    connection_transport_label: 'Server unavailable',
    connection_transport_details: 'Failed to establish a connection.',
    connection_server_down_label: 'Server unavailable',
    connection_server_down_details: 'The server is temporarily unavailable.',
    connection_lost_label: 'No connection to the server',
    connection_lost_details: 'Trying to restore the connection.',
    connection_attempt: 'Attempt {{attempt}}.',
    connection_waiting_players: 'Waiting for players to connect',

    abbot_title: 'Recall abbot',
    abbot_description:
      'Remove the abbot from {{location}} and get {{points}} {{unit}}.',
    abbot_recall_button: 'Recall abbot',
    abbot_points_one: 'point',
    abbot_points_two: 'points',
    abbot_points_five: 'points',
    abbot_points_other: 'points',
    abbot_location_monastery: 'the monastery',
    abbot_location_garden: 'the garden',

    follower_penalty:
      'The princess removed a follower — you cannot place your piece on this tile. End your turn.',
    follower_no_options: 'No available options',
    follower_fairy_hint_placing:
      'You can move the fairy to one of your followers or end your turn.',
    follower_fairy_hint_offer:
      'Instead of placing a follower, you can move the fairy.',
    follower_show_tile: 'Show tile {{x}}, {{y}}',
    follower_finish_turn: 'End turn',
    follower_skip: 'Skip placement',
    follower_abbot: 'abbot',
    follower_big: 'big follower',
    follower_monk: 'monk',
    follower_panel_move_fairy: 'Move fairy',
    follower_panel_place: 'Place follower',
    follower_portal_choose_tile:
      'Magic portal: choose a tile on the board to place your follower',
    follower_portal_tile: 'Tile {{x}}, {{y}}',
    follower_portal_tile_count: '{{count}} options',
    follower_portal_selected: 'Tile {{x}}, {{y}}',
    follower_label_monk: '{{title}} — monk',
    follower_label_typed: '{{title}} — {{type}}',
    fairy_target_abbot: 'Fairy to the abbot of {{player}}',
    fairy_target_big: 'Fairy to the big follower of {{player}}',
    fairy_target_peasant: 'Fairy to the peasant of {{player}}',
    fairy_target_follower: 'Fairy to the follower of {{player}}',
    fairy_target_unknown_player: 'the player',

    dragon_panel_title: 'Dragon movement',
    princess_panel_title: 'Princess',
    dragon_instructions:
      'Choose an adjacent placed tile on the board. Steps left: {{steps}}.',
    princess_instructions:
      'Choose the knight the princess will drive out of the city. If there are several knights in the city, you choose — including your own.',
    princess_kind_big: 'Big knight',
    princess_kind: 'Knight',
    princess_label: '{{kind}} — {{player}}',
    princess_unknown_player: 'follower',

    result_title: 'Game results',
    result_close_title: 'Close results',
    result_close_aria: 'Close game results',
    result_winner: 'Winner',
    result_to_lobby: 'To lobby',
    result_play_again: 'Play again',
    result_finished: 'The game is over',
    result_winner_one: 'Winner: {{name}}',
    result_draw: 'Draw: {{names}}',
    breakdown_cities: 'Cities',
    breakdown_roads: 'Roads',
    breakdown_monasteries: 'Monasteries',
    breakdown_gardens: 'Gardens',
    breakdown_fields: 'Fields',
    breakdown_other: 'Other points',

    turn_short: 'turn {{number}}',
    turn_hide_summary: 'Hide turn summary',
    turn_hide: 'Hide',
    turn_tile: 'Tile {{id}}',
    turn_go_to_cell: 'Go to cell {{row}}, {{col}}',
    turn_go_to_tile: 'Go to the tile on the board',
    turn_follower_on: 'Follower on {{place}}',
    turn_returned: 'Followers returned: {{count}}',
    turn_dragon_moved: 'The dragon moved',
    turn_fairy_moved: 'The fairy moved',
    turn_princess_took: 'The princess removed a follower',
    turn_you: 'You',
    turn_final_scoring: 'Final scoring',
    turn_your_turn: 'Your turn',
    turn_object: 'Feature',
    turn_score_awarded: 'Points awarded: {{points}}',
    turn_player_fallback: 'Player {{id}}',
    turn_player_turn: "Player's turn",
    panel_expand: 'Expand window',
    panel_collapse: 'Collapse window',
    history_title: 'Move history',
    history_turn_short: 'turn',
    history_round: 'round {{number}}',
    history_expand: 'Expand history',
    history_collapse: 'Collapse history',
    history_filter_aria: 'History filter',
    history_empty: 'No actions of this type',
    history_filter_all: 'All',
    history_filter_tiles: 'Tiles',
    history_filter_followers: 'Followers',
    history_filter_scores: 'Points',
    history_filter_returns: 'Returns',
    history_filter_dragon: 'Dragon',
    history_filter_princess: 'Princess',
    history_filter_fairy: 'Fairy',
    history_coordinates: 'Row {{row}}, column {{col}}',
    history_final_scoring: 'Final scoring',
    history_move: 'Turn {{number}}',
    follower_name_robber: 'robber',
    follower_name_knight: 'knight',
    follower_name_monk: 'monk',
    follower_name_abbot: 'abbot',
    follower_name_peasant: 'peasant',
    follower_name_generic: 'follower',
    follower_big_hint: '* — big follower',
    action_completed_object: 'Feature completed.',
    action_show_object: 'Show the feature on the board',
    action_points_awarded: 'Points awarded:',
    action_returned_followers: 'Followers returned.',
    action_dragon_moved: 'The dragon moved.',
    action_from_cell: 'From cell',
    action_to_cell: 'to cell',
    action_steps_left: 'Steps left: {{steps}}.',
    action_eaten_followers: 'Followers eaten:',
    action_fairy_moved: 'The fairy moved.',
    action_fairy_point: 'Fairy point.',
    action_fairy_receives: 'gets {{points}} {{unit}} for {{kind}}.',
    action_points_one: 'point',
    action_points_two: 'points',
    action_points_five: 'points',
    action_points_other: 'points',
    action_fairy_kind_abbot: 'the abbot',
    action_fairy_kind_big: 'the big follower',
    action_fairy_kind_peasant: 'the peasant',
    action_fairy_kind_follower: 'the follower',
    action_placed_follower_prefix: 'Placed',
    action_on_cell: 'On cell',
    action_on_object: 'on the feature',
    action_object_generic: 'feature',
    action_tile_placed: 'Tile placed.',
    action_tile_on_cell: 'Tile {{id}} on cell',
    action_princess_took: 'The princess removed a follower.',
    action_city_on_cell: 'City on cell',
    action_follower_label: 'Follower:',

    board_rotate_ccw: 'Rotate tile counterclockwise',
    board_rotate_cw: 'Rotate tile clockwise',
    board_dragon: 'Dragon',
    board_cell: 'Cell {{row}}, {{col}}',
    board_cell_busy: 'Cell {{row}}, {{col}}, occupied',
    board_fairy_unbound: 'Fairy, not attached to a follower',
    board_fairy_at_player: 'Fairy at the follower of player {{name}}',
    board_choose_cell: 'Choose a cell on the board',
    board_keys_hint: 'Keys: R — rotate, P — place, Esc — clear selection',
    board_place_on_selected: 'Place the tile on the selected cell',
    board_select_cell_first: 'Choose a cell on the board first',
    board_place: 'Place',
    board_zoom_out: 'Zoom out',
    board_zoom_out_aria: 'Zoom out the board',
    board_zoom_reset: 'Reset zoom',
    board_zoom_in: 'Zoom in',
    board_zoom_in_aria: 'Zoom in the board',

    lobby_title: 'Carcassonne',
    lobby_subtitle: 'Build medieval lands together with friends',
    lobby_connecting: 'Connecting to the server...',
    lobby_loading_games: 'Loading the games list...',
    lobby_show_ended: 'Show finished games',
    lobby_create_game: 'Create a new game',
    lobby_find_room: 'Find a room by number',
    lobby_room_placeholder: 'For example, 482731',
    lobby_room_not_found: 'Room not found',
    lobby_no_games: 'No current games',
    lobby_check_room: 'Check the room number and try again',
    lobby_create_or_join: 'Create a new game or join an existing one',
    lobby_room_title: 'Room #{{code}}',
    lobby_room_subtitle:
      'Take free slots or leave them to the computer opponent',
    lobby_players: 'Players',
    lobby_free_slots: 'Free slots',
    lobby_leave_room: 'Leave room',
    lobby_back_to_list: 'Back to list',
    lobby_start_game: 'Start game',
    lobby_game_party: 'Game "{{name}}"',
    lobby_copy_room_code: 'Copy room number',
    lobby_copy_room_code_aria: 'Copy room number {{code}}',
    lobby_room_copied: 'Room number copied',
    lobby_copy_room_number: 'Copy number',
    lobby_copied: 'Copied',
    lobby_last_game: 'Latest',
    lobby_updated: 'Updated {{time}}',
    lobby_status_round: 'Round {{number}}',
    lobby_status_ended: 'Finished',
    lobby_status_waiting: 'Waiting for players',
    lobby_join: 'Join',
    lobby_continue: 'Continue',
    lobby_load: 'Load',
    lobby_spectator: 'Watch',
    lobby_player_placeholder: 'Player {{index}}',
    lobby_ai: 'AI',
    lobby_release: 'Release',
    lobby_take: 'Take',
    lobby_rule_on: 'on',
    lobby_rule_off: 'off',
    lobby_create_title: 'Create game',
    lobby_create_description: 'Configure the rules for a new game',
    lobby_final_scoring: 'Final scoring',
    lobby_final_scoring_description:
      'If enabled, points are awarded at the end of the game for incomplete roads, cities, monasteries, and gardens.',
    lobby_expansions: 'Expansions',
    expansion_inns: 'Inns and Cathedrals',
    expansion_river: 'River',
    expansion_princess: 'Princess and Dragon',
    expansion_inns_description: 'Adds 18 expansion tiles and a big follower.',
    expansion_river_description:
      'At the start of the game a river is placed from the spring to the lake, then the regular deck follows.',
    expansion_princess_description:
      'Adds tiles with the princess, the dragon, and volcanoes.',
    lobby_cancel: 'Cancel',
    lobby_create_submit: 'Create game',
    lobby_password_placeholder: 'Room password',
    lobby_password_label: 'Password',
    lobby_private_label: 'Private room',
    lobby_private_description:
      'The room will not appear in the public list. Join only by room number and password.',
    lobby_google_login: 'Sign in with Google',
    lobby_google_login_title: 'Sign in with Google OAuth',

    lobby_invite: 'Invite',
    lobby_invite_link: 'Room link',
    lobby_link_copied: 'Link copied',

    stats_draw: 'Draw',
    stats_leader: 'Score leader',
    stats_you: 'You',
    stats_you_short: 'You',
    stats_game_points: 'Points for the game',
    stats_ordinary_in_supply: '{{count}} followers in supply',
    stats_big_in_supply: '{{count}} big followers in supply',
    stats_abbot_in_supply: 'Abbot in supply',
    stats_abbot_on_board: 'Abbot on the board',
    stats_turn_score: 'Points this turn: +{{score}}',
    stats_progress: 'Progress',
    stats_in_deck: 'In the deck: {{count}}',
    stats_turn: 'Turn',
    stats_current: 'Playing:',
    stats_thinking: 'thinking',
    stats_next: 'Next:',
    stats_turn_order: 'Turn order',
    stats_player: 'Player',
    stats_playing_now: 'Playing now: {{name}}',
    stats_in_queue: 'In queue: {{name}}',
    stats_turn_short: 'turn {{number}}',
    stats_ai: 'AI',
    phase_dragon_own: 'Choose where the dragon steps',
    phase_dragon_other: '{{name}} moves the dragon',
    phase_princess_own: 'Choose a follower for the princess',
    phase_princess_other: '{{name}} chooses a follower',
    phase_follower_own: 'Place a follower or skip',
    phase_follower_other: '{{name}} places a follower',
    phase_tile_own: 'Place a tile on the board',
    phase_tile_other: '{{name}} places a tile',
    phase_waiting_own: 'Your turn',
    phase_waiting_other: '{{name}} is preparing for their turn',
    stats_cities: 'cities',
    stats_roads: 'roads',
    stats_monasteries: 'monasteries',
    stats_gardens: 'gardens',
    stats_city_one: 'city',
    stats_city_two: 'cities',
    stats_city_five: 'cities',
    stats_road_one: 'road',
    stats_road_two: 'roads',
    stats_road_five: 'roads',
    stats_monastery_one: 'monastery',
    stats_monastery_two: 'monasteries',
    stats_monastery_five: 'monasteries',
    stats_garden_one: 'garden',
    stats_garden_two: 'gardens',
    stats_garden_five: 'gardens',
    stats_plural_other_places: 'places',

    rules_close: 'Close',
    rules_dragon_zero: 'D',
    rules_follower_returned: 'Follower returned to supply',
    tile_image_alt: 'Tile {{id}}',
    score_tiles_road: 'Road tiles',
    score_tiles_city: 'City tiles',
    score_shields_city: 'Coat of arms in the city',
    score_tile_monastery: 'Monastery tile',
    score_tile_garden: 'Garden tile',
    score_around_tiles: 'Occupied surrounding tiles',
    score_completed_monastery: 'Completed monastery',
    score_completed_garden: 'Completed garden',
    score_fairy_bonus: 'Fairy bonus',
    score_field_cities: 'Completed cities by the field',
    modifier_inn_completed: 'Inn: 2 points for each road tile',
    modifier_inn_incomplete: 'Inn: an incomplete road scores 0 points',
    modifier_cathedral_completed:
      'Cathedral: 3 points for each city tile and coat of arms',
    modifier_cathedral_incomplete:
      'Cathedral: an incomplete city scores 0 points',
    ui_error_account_link_failed: 'Failed to link account. Try again',
    ui_error_account_restore_failed:
      'Failed to restore access to games. Try again',
    ui_settings: 'Settings',
    ui_settings_sound: 'Sound',
    ui_settings_animations: 'Animations',
    ui_settings_notifications: 'Notifications',
    ui_settings_account: 'Account',
    ui_settings_close: 'Close',
    ui_onboarding_place_tile_title: 'First tile',
    ui_onboarding_place_tile_hint:
      'Choose a free cell on the board and press «Place» to lay your tile.',
    ui_onboarding_place_follower_title: 'Follower',
    ui_onboarding_place_follower_hint:
      'After placing a tile, you can put a follower on a city, road, monastery or garden.',
    ui_onboarding_move_dragon_title: 'Dragon',
    ui_onboarding_move_dragon_hint:
      'Choose an adjacent tile for the dragon to step on. Each step eats followers on the way.',
    ui_onboarding_princess_title: 'Princess',
    ui_onboarding_princess_hint:
      'The princess drives a knight out of the city. Choose whose follower to remove.',
    ui_onboarding_move_fairy_title: 'Fairy',
    ui_onboarding_move_fairy_hint:
      'Instead of placing a follower, you can move the fairy to your piece — it scores a point at turn end.',
    ui_onboarding_recall_abbot_title: 'Recall abbot',
    ui_onboarding_recall_abbot_hint:
      'Take the abbot back from a monastery or garden and score points for each adjacent tile.',
    ui_onboarding_done: 'Got it',
    ui_onboarding_skip: 'Skip tutorial',
    ui_account_title: 'Account',
    ui_account_signed_in: 'Signed in as',
    ui_account_not_linked: 'Account not linked',
    ui_account_link_google: 'Link account via Google',
    ui_account_restore: 'Restore access to games',
    ui_account_user_id: 'User ID (Firebase Auth)',
    ui_account_restore_button: 'Restore',
    ui_account_restored: 'Access restored: {count} active games you can rejoin',
    ui_account_linked: 'Account linked',
  },
}

function toErrorCode(prefix: string, key: string): string {
  const snake = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  return `${prefix}.${snake}`
}

function catalogToCodes(
  prefix: string,
  catalog: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(catalog).map(([key, message]) => [
      toErrorCode(prefix, key),
      message,
    ])
  )
}

/**
 * Русские тексты ошибок берутся из серверных справочников, чтобы не
 * дублировать строки: сервер присылает машинный код, клиент находит по нему
 * перевод на выбранном языке.
 */
const russianErrorMessages: Record<string, string> = {
  ...catalogToCodes('common', CommonErrors),
  ...catalogToCodes('lobby', LobbyErrors),
  ...catalogToCodes('game', GameErrors),
}

const errors: Record<Locale, Record<string, string>> = {
  ru: russianErrorMessages,
  en: {
    'common.game_not_found': 'Game not found',
    'common.player_not_found_in_game': 'Player not found in this game',
    'common.session_required': 'Session is not ready. Reconnect to the server',
    'common.internal_failure': 'Something went wrong. Try again',
    'common.save_failed': 'Failed to save changes. Try again',
    'common.invalid_request': 'Invalid request. Check the data and try again',
    'common.too_many_requests':
      'Too many requests. Wait a moment and try again',
    'common.too_many_connections': 'Too many connections. Try again later',
    'common.join_attempts_exceeded':
      'Too many failed join attempts. Try again later',
    'lobby.all_slots_taken': 'All slots are taken',
    'lobby.slot_edit_forbidden': 'Not enough rights to change this slot',
    'lobby.only_lobby_owner_can_start':
      'Only the lobby creator can start the game',
    'lobby.invalid_final_scoring_option': 'Invalid "Final scoring" option',
    'lobby.invalid_inns_and_cathedrals_option':
      'Invalid "Inns and Cathedrals" expansion option',
    'lobby.invalid_river_option': 'Invalid "River" expansion option',
    'lobby.invalid_princess_and_dragon_option':
      'Invalid "Princess and the Dragon" expansion option',
    'lobby.start_failed': 'Failed to start the game',
    'lobby.not_enough_players':
      'At least two players are required to start the game',
    'lobby.game_already_started': 'The game has already started',
    'lobby.already_joined_game': 'You have already joined the game',
    'lobby.too_many_games':
      'Too many active games on the server. Try again later',
    'lobby.too_many_owned_lobbies':
      'You have created too many lobbies. Finish old games',
    'lobby.too_many_ai_games':
      'Too many computer games on the server. Try again later',
    'lobby.too_many_owned_ai_games':
      'You already have computer games. Wait for them to finish',
    'lobby.player_name_too_long': 'Player name is too long',
    'lobby.player_name_invalid': 'Player name contains invalid characters',
    'lobby.player_name_profanity': 'Player name contains prohibited words',
    'lobby.player_name_taken':
      'A player with this name is already in the lobby',
    'lobby.password_required': 'This room is private — password required',
    'lobby.invalid_password': 'Invalid room password',
    'lobby.spectator_not_allowed':
      'You cannot join this game as a spectator — it has not started yet',
    'lobby.spectator_limit_reached': 'Too many spectators in this game',
    'game.not_players_turn': "It's another player's turn — wait for your turn",
    'game.invalid_tile_rotation': 'Invalid tile rotation',
    'game.resolve_expansion_action_first':
      'Finish the current expansion action first',
    'game.no_tile_waiting': 'There is no tile to place',
    'game.not_placing_follower': 'You cannot place followers now',
    'game.invalid_follower_placement': 'Invalid follower placement',
    'game.follower_placement_unavailable':
      'Placing followers is no longer available',
    'game.no_abbot_on_board': 'The player has no abbot on the board',
    'game.invalid_dragon_turn': 'You cannot move the dragon now',
    'game.invalid_dragon_destination': 'The dragon cannot be moved there',
    'game.not_placing_fairy': 'You cannot move the fairy now',
    'game.invalid_fairy_target':
      'The fairy can only stand next to your own follower',
    'game.princess_choice_not_pending':
      "The princess isn't waiting for a city choice",
    'game.invalid_princess_city': 'Invalid city for the princess',
  },
}

let _locale: Locale = DEFAULT_LOCALE
export const locale: Ref<Locale> = ref(_locale)

export function getLocale(): Locale {
  return locale.value
}

export function setLocale(value: Locale): void {
  if (!availableLocales.includes(value)) return
  _locale = value
  locale.value = value
  if (typeof document !== 'undefined') {
    document.documentElement.lang = value
  }
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, value)
  } catch {
    // Приватный режим или переполненное хранилище: выбор языка проживёт
    // только до перезагрузки страницы.
  }
}

export function initLocale(): void {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    stored = null
  }
  if (stored && availableLocales.includes(stored as Locale)) {
    setLocale(stored as Locale)
    return
  }
  const browser =
    typeof navigator !== 'undefined' ? navigator.language : undefined
  if (browser) {
    const match = availableLocales.find((l) =>
      browser.toLowerCase().startsWith(l)
    )
    if (match) {
      setLocale(match)
      return
    }
  }
  setLocale(DEFAULT_LOCALE)
}

function interpolate(
  message: string,
  params?: Record<string, string | number>
): string {
  if (!params) return message
  return message.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) => {
    const value = params[key]
    return value === undefined ? _match : String(value)
  })
}

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const byLocale = messages[locale.value] ?? messages[FALLBACK_LOCALE]
  let message = byLocale[key]
  if (message === undefined) {
    message = messages[FALLBACK_LOCALE]?.[key]
  }
  if (message === undefined) return key
  return interpolate(message, params)
}

export function tError(code: string, defaultMessage?: string): string {
  const byLocale = errors[locale.value] ?? errors[FALLBACK_LOCALE]
  let message = byLocale[code]
  if (message === undefined) {
    message = errors[FALLBACK_LOCALE]?.[code]
  }
  if (message === undefined) return defaultMessage ?? code
  return message
}

/**
 * Перевод подписей и бонусов из детализации начисления очков.
 *
 * Сервер присылает их готовыми строками на русском. Клиент сопоставляет
 * известные формулировки с ключами словаря, чтобы интерфейс оставался
 * одноязычным при любом выбранном языке. Неизвестный текст показывается как
 * есть.
 */
export function localizeScoreText(text: string): string {
  if (locale.value === 'ru') return text
  const map: Record<string, string> = {
    'Тайлы дороги': t('score_tiles_road'),
    'Тайлы города': t('score_tiles_city'),
    'Гербы в городе': t('score_shields_city'),
    'Тайл монастыря': t('score_tile_monastery'),
    'Тайл сада': t('score_tile_garden'),
    'Занятые клетки вокруг': t('score_around_tiles'),
    'Завершённый монастырь': t('score_completed_monastery'),
    'Завершённый сад': t('score_completed_garden'),
    'Бонус феи': t('score_fairy_bonus'),
    'Завершённые города у поля': t('score_field_cities'),
    'Таверна: 2 очка за каждый тайл дороги': t('modifier_inn_completed'),
    'Таверна: незавершённая дорога приносит 0 очков': t(
      'modifier_inn_incomplete'
    ),
    'Собор: 3 очка за каждый тайл и герб города': t(
      'modifier_cathedral_completed'
    ),
    'Собор: незавершённый город приносит 0 очков': t(
      'modifier_cathedral_incomplete'
    ),
  }
  return map[text] ?? text
}

/**
 * Склонение существительного после числа.
 *
 * Для русского: одна / две-четыре / пять. Для английского: one / other.
 */
export function plural(
  count: number,
  forms: { one: string; two: string; five: string; other?: string }
): string {
  if (locale.value === 'ru') {
    const n = Math.abs(count)
    if (n % 10 === 1 && n % 100 !== 11) return forms.one
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20))
      return forms.two
    return forms.five
  }
  return count === 1 ? forms.one : (forms.other ?? forms.five)
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale.value, options).format(value)
}

export function formatDate(
  value: Date | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale.value, options).format(new Date(value))
}
