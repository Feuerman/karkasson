import type {
  RulesBlock,
  RulesDocument,
  RulesExample,
  RulesSection,
  RulesTilesRow,
} from './types'

/**
 * Английские переводы текстов правил.
 *
 * Ключ — русская формулировка из исходного документа. Так структура примеров
 * и сетки остаются единственными и не дублируются ради перевода, а любую
 * пропущенную строку ловит тест: после локализации в документе не должно
 * оставаться кириллицы.
 */
const TRANSLATIONS: Record<string, string> = {
  'Правила игры': 'Game rules',
  'Базовая игра и дополнения «Таверны и соборы», «Река» и «Принцесса и дракон»':
    'Base game and the Inns and Cathedrals, River, and Princess and Dragon expansions',
  'Базовая игра': 'Base game',
  'Таверны и соборы': 'Inns and Cathedrals',
  'Принцесса и дракон': 'Princess and Dragon',
  Река: 'River',

  'Цель игры': 'Goal of the game',
  'Игроки по очереди выкладывают тайлы, достраивая карту средневекового княжества, и отправляют своих подданных в города, на дороги, в монастыри и сады. Подданные приносят очки, когда объект достроен, а в конце партии — когда он остался незавершённым. Побеждает игрок с наибольшим счётом; при равенстве победа делится.':
    'Players take turns placing tiles, building the map of a medieval principality, and sending their followers into cities, onto roads, into monasteries, and into gardens. Followers score when a feature is completed and, at the end of the game, when it remains incomplete. The player with the highest score wins; ties share the victory.',
  Термины: 'Terms',
  'Тайл — квадратная плитка с нарисованным ландшафтом. Объект — то, что можно достраивать: дорога, город, монастырь или сад. На одном тайле может быть сразу несколько объектов: например, дорога и город, или сад посреди города. Подданный — фишка игрока, который «живёт» на объекте: рыцарь в городе, разбойник на дороге, монах в монастыре. Аббат — особая фишка, которую ставят в монастырь или сад. Домики, деревья и прочие рисунки на тайлах на игру не влияют. В онлайн-версии поля и крестьяне не реализованы.':
    'A tile is a square piece with a landscape drawn on it. A feature is something that can be built up: a road, a city, a monastery, or a garden. A single tile may contain several features at once: for example, a road and a city, or a garden in the middle of a city. A follower is a player piece that "lives" on a feature: a knight in a city, a robber on a road, a monk in a monastery. The abbot is a special piece placed in a monastery or garden. Houses, trees, and other drawings on tiles do not affect the game. Fields and peasants are not implemented in the online version.',
  'Примеры базовых тайлов': 'Base tile examples',
  'Монастырь и дорога': 'Monastery and road',
  Монастырь: 'Monastery',
  Город: 'City',
  'Прямая дорога': 'Straight road',
  Перекрёсток: 'Crossroads',
  'Подготовка к игре': 'Setup',
  'В колоде 72 базовых тайла. Первый тайл уже лежит на поле лицом вверх, остальные перемешаны и ждут хода. Каждому игроку выдаётся 7 обычных подданных и один аббат. Первым ходит игрок из первого слота лобби, дальше ходят по кругу.':
    'The deck contains 72 base tiles. The first tile is already on the board face up, the rest are shuffled and waiting. Each player receives 7 ordinary followers and one abbot. The player in the first lobby slot goes first, then play continues clockwise.',
  Счёт: 'Scoring',
  'Очки считает сервер — вручную ничего добавлять не нужно. Начисления видны в журнале истории. В настольной игре для этого есть дорожка подсчёта очков и восьмой подданный, который кладётся на неё; в онлайн-версии дорожки нет, поэтому в запасе всегда все 8 фишек: 7 подданных и аббат.':
    'The server calculates points — nothing needs to be added manually. Awards are shown in the history log. In the board game there is a score track and an eighth follower placed on it; the online version has no track, so all 8 pieces are always in the supply: 7 followers and the abbot.',
  'Ход игрока': "Player's turn",
  'Возьмите тайл и присоедините его к уже выложенным.':
    'Take a tile and attach it to the tiles already placed.',
  'По желанию поставьте одного своего подданного на объект этого тайла или пропустите размещение.':
    'Optionally place one of your followers on a feature of this tile, or skip the placement.',
  'Получите очки за объекты, которые завершились при выкладывании тайла; вернувшиеся подданные снова доступны со следующего хода.':
    'Score for features completed by placing the tile; returned followers become available again from the next turn.',
  'Размещение тайла': 'Placing a tile',
  'Новый тайл должен соприкасаться стороной хотя бы с одним выложенным тайлом — соприкосновение углами не считается. Все соприкасающиеся стороны обязаны совпадать: город с городом, дорога с дорогой, поле с полем. Тайл разрешено поворачивать, но совпадение сторон от этого не перестаёт быть обязательным. Если для вытянутого тайла нет ни одного допустимого места, он убирается из партии, а игрок вытягивает следующий тайл.':
    'A new tile must touch at least one placed tile by a side — touching at corners does not count. All touching sides must match: city with city, road with road, field with field. A tile may be rotated, but matching sides remain mandatory. If there is no legal place for the drawn tile, it is removed from the game and the player draws the next tile.',
  'Соединяются только стороны': 'Only sides connect',
  'Города, дороги и монастыри соединяются друг с другом только сторонами. Соприкосновение углами связи не даёт, как и пустые клетки между тайлами: два участка, соприкасающиеся углами, остаются двумя независимыми объектами.':
    'Cities, roads, and monasteries connect to each other only by sides. Touching at corners and empty cells between tiles do not create a connection: two segments touching at corners remain two independent features.',
  'Дорога не может оборваться': 'A road cannot break off',
  'Дорога не заканчивается ничем: каждая её ветвь обязана перейти в другую дорогу. Конец дороги появляется только там, где дальше дорогу построить нельзя — на перекрёстке, в городе или у монастыря. Поэтому «свободный конец» дороги на краю карты в настольной игре невозможен: если подходящего тайла не нашлось, дорога просто не достраивается.':
    'A road does not end in nothing: each of its branches must continue into another road. A road end appears only where no further road can be built — at a crossroads, a city, or a monastery. Therefore a "free end" of a road at the edge of the map is impossible in the board game: if no suitable tile is found, the road is simply not completed.',
  'Планируйте продолжение объекта': 'Plan how the feature will continue',
  'Легальная постановка не всегда удачна. Дорога или город могут остаться незавершёнными, если свободные клетки у открытых концов займут другие тайлы или соседние грани в этих клетках будут несовместимы. Перед ходом посмотрите, какие места ещё позволят продолжить объект, и не рассчитывайте, что соперники оставят нужную клетку свободной.':
    'A legal placement is not always a good one. A road or city may remain incomplete if other tiles occupy the free cells at open ends, or if the adjacent edges in those cells are incompatible. Before your turn, check which places still allow the feature to continue, and do not count on opponents leaving the needed cell free.',
  'Примеры нежелательных ходов, создающих тупик:':
    'Examples of undesirable moves that create dead ends:',
  'Продолжить дорогу в узкий проход, а затем занять единственную клетку, куда мог лечь тайл с продолжением дороги. Дорога остаётся на карте незавершённой.':
    'Extend a road into a narrow passage, then occupy the only cell where a tile continuing the road could be placed. The road remains incomplete on the map.',
  'Оставить открытый край города рядом с занятыми клетками так, что подходящий городской тайл уже нельзя пристроить без нарушения совпадения сторон.':
    'Leave an open city edge next to occupied cells so that no suitable city tile can be attached without breaking edge matching.',
  'Поставить монастырь в угол, где окружающие клетки постепенно заполняются тайлами: каждый занятый сосед приносит очко, но опустевшие или заблокированные места больше нельзя заполнить.':
    'Place a monastery in a corner where surrounding cells gradually fill with tiles: each occupied neighbor scores a point, but empty or blocked places can no longer be filled.',
  'Некорректное и просто рискованное — не одно и то же':
    'Invalid and merely risky are not the same',
  'Несовпадение граней — запрещённое размещение, сервер его отклонит. «Тупик» — обычно легальная позиция, за которую игрок отвечает сам: правила не гарантируют, что каждый город или дорога будут закрыты.':
    'Mismatched edges are a forbidden placement, and the server will reject it. A "dead end" is usually a legal position for which the player is responsible: the rules do not guarantee that every city or road will be closed.',
  'Размещение подданного': 'Placing a follower',
  'Подданного ставят только на только что выложенный тайл и только на доступный объект: рыцаря в город, разбойника на дорогу, монаха в монастырь.':
    'A follower is placed only on the tile just laid and only on an available feature: a knight into a city, a robber onto a road, a monk into a monastery.',
  'Если на выбранном тайле несколько дорог или городов, выберите, в какой из них поставить подданного.':
    'If the chosen tile has several roads or cities, choose which one to place the follower on.',
  'На объект, где уже есть чей-либо подданный, нового поставить нельзя. Но на разных участках одного города или одной дороги подданные стоять могут: так они встретятся только после соединения участков.':
    "A new follower cannot be placed on a feature that already has someone else's follower. But followers may stand on different segments of the same city or road: they will meet only after the segments connect.",
  'На монастырь или сад ставят аббата; обычного подданного в сад поставить нельзя. Аббата можно отозвать в свой ход вместо размещения подданного и получить 1 очко за сам объект и по 1 за каждый занятый тайл вокруг. Если соседние клетки уже заполнены, объект завершится и аббат получит полные 9 очков.':
    'An abbot is placed in a monastery or garden; an ordinary follower cannot be placed in a garden. On your turn you may recall the abbot instead of placing a follower and get 1 point for the feature itself and 1 for each occupied surrounding tile. If the neighboring cells are already filled, the feature is completed and the abbot gets the full 9 points.',
  'За ход ставится не более одной фишки. Размещение можно пропустить; если запас подходящих фишек исчерпан, ход продолжается без него. Со временем подданные возвращаются в запас.':
    'No more than one piece is placed per turn. Placement may be skipped; if no suitable pieces remain in the supply, the turn continues without it. Over time followers return to the supply.',
  'Отличие от настольной игры: подданный не завершает объект':
    'Difference from the board game: a follower does not complete a feature',
  'В настольной игре допустимо завершить объект только что поставленным подданным: вы кладёте тайл, ставите подданного на ещё никем не занятый объект, объект тут же закрывается, очки начисляются, а подданный возвращается в запас. Так можно «забрать» город или дорогу, достроенную чужим ходом. В онлайн-версии очки за объект начисляются сразу при выкладывании тайла — до размещения подданного. Поэтому подданный, поставленный на только что выложенный тайл, никогда не участвует в подсчёте того объекта, который этот же тайл закрыл: он получит очки позже, когда объект достроят следующим ходом, либо по правилам финального подсчёта. Практический вывод: если ваш тайл закрывает объект, подданного на него ставить незачем.':
    'In the board game it is allowed to complete a feature with a follower that was just placed: you lay a tile, place a follower on a feature no one occupies yet, the feature closes immediately, points are awarded, and the follower returns to the supply. This way you can "take" a city or road completed by another player\'s move. In the online version, points for a feature are awarded immediately when the tile is placed — before a follower is placed. Therefore a follower placed on the tile just laid never participates in scoring the feature that this same tile closed: it will score later, when the feature is completed on a later turn, or under the final scoring rules. Practical conclusion: if your tile closes a feature, there is no reason to place a follower on it.',
  'Когда объект завершён': 'When a feature is complete',
  'Дорога завершена, если оба её конца упираются в перекрёсток, город или монастырь либо если она замкнулась в кольцо. Город завершён, когда он со всех сторон окружён стенами и внутри него нет пустых мест. Монастырь и сад завершены, когда заняты все 8 соседних клеток — по горизонтали, вертикали и диагонали. Очки начисляются сразу после выкладывания тайла, и все подданные завершённого объекта возвращаются владельцам.':
    'A road is complete if both of its ends terminate at a crossroads, city, or monastery, or if it loops back on itself. A city is complete when it is surrounded by walls on all sides and has no empty spaces inside. A monastery and garden are complete when all 8 surrounding cells are occupied — horizontally, vertically, and diagonally. Points are awarded immediately after the tile is placed, and all followers on the completed feature are returned to their owners.',
  'Базовые очки': 'Base scoring',
  'Дорога: 1 очко за каждый тайл дороги.': 'Road: 1 point for each road tile.',
  'Город: 2 очка за каждый тайл города и 2 очка за каждый герб.':
    'City: 2 points for each city tile and 2 points for each coat of arms.',
  'Монастырь: 9 очков — сам тайл и восемь соседей.':
    'Monastery: 9 points — the tile itself and its eight neighbors.',
  'Сад: как монастырь; аббат может быть отозван за 1 очко за сад и по 1 за каждый занятый соседний тайл.':
    'Garden: like a monastery; the abbot can be recalled for 1 point for the garden and 1 for each occupied adjacent tile.',
  'Несколько игроков на одном объекте': 'Several players on one feature',
  'На завершённом объекте могут оказаться подданные разных игроков — если участки дороги или города соединились уже после того, как подданные были поставлены. Очки получает не первый занявший, а тот, у кого на объекте больше подданных. При равенстве каждый лидер получает полную награду, а не долю. Подданные, не получившие очков, остаются на своих местах. Если на объекте не было ни одного подданного, очки за него не получает никто: объект просто закрывается без награды.':
    'Followers of different players may end up on a completed feature if road or city segments connected after the followers were placed. Points go not to the first occupant but to the player with the most followers on the feature. In a tie, each leader gets the full reward, not a share. Followers that did not score remain where they are. If a feature had no followers at all, no one scores for it: the feature simply closes without a reward.',
  'Монастыри и сады считаются иначе':
    'Monasteries and gardens score differently',
  'Монастырь и сад — единственные объекты без борьбы за большинство. Завершённый объект приносит 9 очков каждому подданному, который на нём стоит: если монастырь заняли игроки с двух сторон, очки получают оба, а не только лидер. Аббаты из этого подсчёта исключены — они остаются на объекте и ждут отзыва или финального подсчёта. Незавершённые монастыри и сады, наоборот, делятся по общему правилу большинства: очки получает только лидер, а при равенстве — все лидеры.':
    'Monasteries and gardens are the only features without a majority contest. A completed feature gives 9 points to every follower standing on it: if players from two sides occupy a monastery, both score, not just the leader. Abbots are excluded from this scoring — they remain on the feature and await recall or final scoring. Incomplete monasteries and gardens, on the contrary, follow the usual majority rule: only the leader scores, and in a tie all leaders score.',
  Аббат: 'Abbot',
  'У каждого игрока один аббат. Его ставят в центр монастыря или сада вместо обычного подданного: в сад обычного подданного поставить нельзя. Когда соседние клетки заполнились и объект завершился, аббат получает 9 очков и возвращается в запас. Пока объект не завершён, аббата можно в любой свой ход отозвать вместо размещения подданного: он даёт 1 очко за сам объект и по 1 очку за каждую занятую клетку вокруг, после чего возвращается владельцу. Отзыв не расходует размещение фишки и не передаёт ход сопернику.':
    'Each player has one abbot. It is placed in the center of a monastery or garden instead of an ordinary follower: an ordinary follower cannot be placed in a garden. When the neighboring cells fill and the feature is completed, the abbot gets 9 points and returns to the supply. While the feature is incomplete, on any of your turns you may recall the abbot instead of placing a follower: it gives 1 point for the feature itself and 1 point for each occupied surrounding cell, then returns to its owner. Recalling does not use up the follower placement and does not pass the turn to an opponent.',
  'Монастыри и сады': 'Monasteries and gardens',
  Сад: 'Garden',
  'Конец игры и незавершённые объекты':
    'End of the game and incomplete features',
  'Партия заканчивается, когда колода опустела. Финальный подсчёт незавершённых объектов выбирается при создании партии и по умолчанию выключен. Если он включён, дорога даёт 1 очко за тайл, город — 1 за тайл и 1 за герб, монастырь или сад — 1 за объект и 1 за каждый занятый тайл вокруг. Очки получают только игроки, чьи подданные находятся на объекте; обладатели большинства или все лидеры при равенстве. Очки за поля и за крестьян не начисляются: в онлайн-версии их нет.':
    'The game ends when the deck runs out. Final scoring of incomplete features is chosen when creating the game and is off by default. If it is enabled, a road gives 1 point per tile, a city 1 per tile and 1 per coat of arms, a monastery or garden 1 for the feature and 1 for each occupied surrounding tile. Only players whose followers are on the feature score; the majority holders, or all leaders in a tie. Fields and peasants do not score: they do not exist in the online version.',
  'Краткая таблица базовых очков': 'Quick base scoring table',
  Объект: 'Feature',
  'Во время игры': 'During the game',
  'В конце игры (если включён финальный подсчёт)':
    'At the end of the game (if final scoring is enabled)',
  Дорога: 'Road',
  '1 очко / тайл': '1 point / tile',
  '2 очка / тайл + 2 за герб': '2 points / tile + 2 per coat of arms',
  '1 очко / тайл + 1 за герб': '1 point / tile + 1 per coat of arms',
  '9 очков каждому подданному': '9 points to each follower',
  '1 + все занятые тайлы вокруг': '1 + all occupied surrounding tiles',
  'Сад (аббат)': 'Garden (abbot)',
  'При отзыве: 1 + тайлы вокруг': 'On recall: 1 + surrounding tiles',
  'Домашние правила и вариации': 'House rules and variations',
  'Вариации и домашние правила (игра с несколькими тайлами в руке, дополнительные ходы, границы стола как границы поля и прочие) в онлайн-версии не поддерживаются — партия всегда играется по правилам, описанным выше.':
    'Variations and house rules (holding several tiles, extra turns, table edges as board edges, and others) are not supported in the online version — the game is always played by the rules described above.',
  'Как читать примеры': 'How to read the examples',
  'Синяя пунктирная рамка — только что выложенный тайл; зелёная — завершённый объект. Цветная точка — подданный (крупная точка — большой подданный); красный крестик — недопустимая позиция. Зелёная плашка под схемой показывает фишку, которая вернулась в запас: её съел дракон или её забрал игрок.':
    'The blue dashed border marks the tile just placed; green marks a completed feature. A colored dot is a follower (a larger dot is a big follower); a red cross marks an invalid position. The green badge under the diagram shows a piece returned to the supply: eaten by the dragon or taken by a player.',

  // Примеры базовой игры.
  'Дорога к дороге': 'Road to road',
  'Новый тайл с дорогой прилегает к тайлам с дорогой: грани «дорога» должны совпадать.':
    'The new tile with a road is adjacent to tiles with roads: the "road" edges must match.',
  'Все прилегающие грани — дороги. Синяя пунктирная рамка — тайл только что выложен, цветная точка — подданный.':
    'All adjacent edges are roads. The blue dashed border marks the tile just placed, the colored dot is a follower.',
  'Так ставить нельзя': 'You cannot place it like this',
  'Грань «дорога» не может прилегать к грани «поле». Красный крестик отмечает несовпадение.':
    'A "road" edge cannot be adjacent to a "field" edge. The red cross marks the mismatch.',
  'Новый тайл можно повернуть или положить в другое место, но не так.':
    'The new tile can be rotated or placed elsewhere, but not like this.',
  'Завершённый монастырь': 'Completed monastery',
  'Монастырь завершается, когда вокруг него выложены все 8 соседних тайлов.':
    'A monastery is complete when all 8 surrounding tiles have been placed around it.',
  'Монастырь + 8 окружающих тайлов = 9 очков. Зелёная рамка отмечает весь завершённый объект, коралловая точка — монаха.':
    'Monastery + 8 surrounding tiles = 9 points. The green border marks the whole completed feature, the coral dot is the monk.',
  'Углы не соединяют': 'Corners do not connect',
  'Город с городом соединяются только сторонами. Соприкосновение углами и пустые клетки между тайлами связи не дают.':
    'Cities connect to cities only by sides. Touching at corners and empty cells between tiles do not create a connection.',
  'Два одно-гранных города касаются только углом, поэтому это два независимых города. Подданный «кораллового» не мешает другому игроку поставить фишку во второй город.':
    'Two single-edge cities touch only at a corner, so they are two independent cities. The coral follower does not prevent another player from placing a follower in the second city.',
  'Дорога упирается в перекрёсток': 'The road ends at a crossroads',
  'Перекрёсток обрывает дорогу так же, как город или монастырь. Сам перекрёсток при этом даёт три отдельные незавершённые дороги.':
    'A crossroads ends a road just like a city or monastery. At the same time the crossroads itself has three separate incomplete roads.',
  'Один конец дороги упирается в перекрёсток, другой — в монастырь: дорога из 2 тайлов завершена и даёт 2 очка. Три дороги самого перекрёстка (на восток, запад и продолжение на север) остаются незавершёнными, пока их концы не упрутся в города или монастыри.':
    'One end of the road ends at a crossroads, the other at a monastery: the 2-tile road is complete and scores 2 points. The three roads of the crossroads itself (east, west, and the continuation north) remain incomplete until their ends reach a city or monastery.',
  'Дорога замкнулась в кольцо': 'The road forms a loop',
  'Четыре изогнутых тайла образуют замкнутую петлю. Ни один конец не упирается в город или монастырь, но дорога всё равно завершена.':
    'Four curved tiles form a closed loop. Neither end ends at a city or monastery, but the road is still complete.',
  'Дорога со всех сторон окружена полями, но кольцо замкнуто: 4 тайла × 1 очко = 4 очка. Подданный «небесно-голубого» получает очки и возвращается в запас.':
    'The road is surrounded by fields on all sides, but the loop is closed: 4 tiles × 1 point = 4 points. The sky-blue follower scores and returns to the supply.',
  'Отзыв аббата': 'Recalling the abbot',
  'Вместо того чтобы ставить подданного, игрок забирает своего аббата из незавершённого сада и получает очки за сам сад и за каждый занятый тайл вокруг.':
    'Instead of placing a follower, the player recalls their abbot from an incomplete garden and scores for the garden itself and for each occupied surrounding tile.',
  'Вокруг сада занято 5 из 8 клеток, поэтому отзыв аббата даёт 1 очко за сам сад и по 1 за каждый соседний тайл — всего 6 очков. Аббат возвращается в запас, ход при этом не тратится. Два верхних тайла примыкают к саду гранями города: сад лежит на тайле, у которого есть и сад, и две городские стороны.':
    '5 of the 8 cells around the garden are occupied, so recalling the abbot scores 1 point for the garden itself and 1 for each adjacent tile — 6 points in total. The abbot returns to the supply and the turn is not used up. The two upper tiles touch the garden with city edges: the garden lies on a tile that has both a garden and two city sides.',
  'Сад и его окрестность': 'The garden and its surroundings',
  'Сад отмечен золотым значком на тайле. Аббат ставится в центр сада и остаётся там до отзыва или конца партии.':
    'The garden is marked with a gold symbol on the tile. The abbot is placed in the center of the garden and stays there until recalled or the game ends.',
  'Сад и 4 занятых соседних клетки дают аббату 5 очков при отзыве или финальном подсчёте.':
    'The garden and 4 occupied adjacent cells give the abbot 5 points on recall or during final scoring.',
  'Завершённый сад': 'Completed garden',
  'Сад завершается, когда заняты все 8 клеток вокруг него. Значок сада показан на центральном тайле.':
    'A garden is complete when all 8 cells around it are occupied. The garden symbol is shown on the central tile.',
  'Полностью окружённый сад даёт аббату 9 очков при отзыве или финальном подсчёте.':
    'A fully surrounded garden gives the abbot 9 points on recall or during final scoring.',
  'Завершённая дорога': 'Completed road',
  'Дорога завершена, когда оба её конца упираются в монастырь, город или перекрёсток.':
    'A road is complete when both ends terminate at a monastery, city, or crossroads.',
  'Три тайла дороги дают 3 очка.': 'Three road tiles give 3 points.',
  'Завершённый город-крепость': 'Completed fortress city',
  'На тайле-крепости весь участок города объединён внутри одной плитки и не имеет открытых продолжений.':
    'On a fortress tile the entire city segment is contained within a single tile and has no open continuations.',
  'Город-крепость из 5 тайлов: 4 обычных 4*2 = 8 очков + 1 с гербом = 4 очка (2 за тайл + 2 за герб). Всего за город будет начислено 12 очков.':
    'A fortress city of 5 tiles: 4 ordinary 4*2 = 8 points + 1 with a coat of arms = 4 points (2 per tile + 2 for the coat of arms). The city scores 12 points in total.',
  'Занятый объект': 'Occupied feature',
  'На один объект (здесь — одна дорога) можно поставить только одного подданного.':
    'Only one follower can be placed on a single feature (here, one road).',
  'Дорога уже занята подданным («коралловая» точка) — сюда ставить нельзя (красный крестик).':
    'The road is already occupied by a follower (the coral dot) — you cannot place here (red cross).',
  'Таверна на дороге': 'Inn on a road',
  'Таверна входит в одну дорогу с монастырями на её концах. Подданный может находиться на любом тайле этой дороги.':
    'The inn belongs to the same road as the monasteries at its ends. A follower may be on any tile of this road.',
  'Завершённая дорога из 3 тайлов с таверной даёт 6 очков (3 × 2). Если бы дорога осталась незавершённой к концу партии, она принесла бы 0 очков.':
    'A completed 3-tile road with an inn scores 6 points (3 × 2). If the road remained incomplete at the end of the game, it would score 0 points.',
  'Две таверны на одной дороге': 'Two inns on one road',
  'Обе таверны принадлежат одной дороге, но удваивают её награду только один раз: дорога считается один раз по 2 очка за тайл.':
    'Both inns belong to the same road but double its reward only once: the road scores once at 2 points per tile.',
  'Дорога из 4 тайлов с двумя тавернами приносит 4 × 2 = 8 очков, а не 16. На двух средних тайлах есть ещё и сад — он считается по обычным правилам для садов.':
    'A 4-tile road with two inns scores 4 × 2 = 8 points, not 16. The two middle tiles also have a garden — it is scored by the usual garden rules.',
  'Большой подданный на дороге': 'Big follower on a road',
  'Два участка дороги стали одной дорогой, и на каждом остался подданный. Большой подданный считается за двух и перевешивает соперника.':
    'Two road segments became one road, and a follower remained on each. The big follower counts as two and outweighs the opponent.',
  'Оба конца дороги упираются в монастыри, поэтому дорога из 4 тайлов завершена. У «кораллового» большой подданный — 2 голоса против 1 у «небесно-голубого», поэтому все 4 очка получает «коралловый», а подданный соперника остаётся на дороге.':
    "Both ends of the road end at monasteries, so the 4-tile road is complete. Coral has a big follower — 2 votes against 1 for sky blue — so coral gets all 4 points and the opponent's follower stays on the road.",
  'Собор в городе': 'Cathedral in a city',
  'Собор — значок на городском тайле. Он усиливает весь город, к которому присоединён, а не только один тайл.':
    'A cathedral is a symbol on a city tile. It strengthens the entire city it is attached to, not just one tile.',
  'Собор и четыре одно-гранных тайла замыкают город из 5 тайлов: каждый приносит по 3 очка, всего 5 × 3 = 15. Незавершённый город с собором приносит 0 очков при финальном подсчёте. Несколько соборов в одном городе не увеличивают награду.':
    'The cathedral and four single-edge tiles close a 5-tile city: each scores 3 points, 5 × 3 = 15 in total. An incomplete city with a cathedral scores 0 points during final scoring. Multiple cathedrals in one city do not increase the reward.',
  'Большой подданный': 'Big follower',
  'Большого подданного можно поставить на любой объект вместо обычного. При споре за большинство он считается за двух: этого достаточно, чтобы обойти соперника с одной фишкой.':
    'A big follower can be placed on any feature instead of an ordinary one. When competing for the majority it counts as two: enough to beat an opponent with one follower.',
  'Подданные стояли на разных участках города, пока участки не соединились. Теперь у «кораллового» большой подданный — 2 голоса против 1 у «небесно-голубого». Город из 5 тайлов с одним гербом даёт победителю 5 × 2 + 2 = 12 очков, а подданный соперника остаётся на городе и очков не приносит.':
    "The followers stood on different city segments until the segments connected. Now coral has a big follower — 2 votes against 1 for sky blue. The 5-tile city with one coat of arms gives the winner 5 × 2 + 2 = 12 points, while the opponent's follower stays in the city and scores nothing.",
  'Открытая дорога под угрозой тупика': 'An open road at risk of a dead end',
  'Все три тайла дороги состыкованы правильно, но оба конца пока открыты. Это легальная незавершённая позиция: соперники могут занять свободные клетки, подходящие для продолжения.':
    'All three road tiles are joined correctly, but both ends are still open. This is a legal incomplete position: opponents can occupy free cells suitable for continuation.',
  'До вкладывания подданного оцените доступные продолжения. Если дорогу не удастся замкнуть до конца игры, финальная награда будет зависеть от включённого финального подсчёта.':
    'Before placing a follower, assess the available continuations. If the road cannot be closed before the end of the game, the final reward will depend on whether final scoring is enabled.',
  'Две дороги стали одной': 'Two roads became one',
  'Дороги, которые до этого шли отдельно, соединены новым тайлом. На общей дороге оказалось по разбойнику у каждого игрока.':
    'The roads that previously ran separately are joined by a new tile. The shared road has one robber from each player.',
  'Оба конца дороги упираются в монастыри, поэтому дорога завершена: 4 тайла × 1 очко = 4 очка. Разбойников поровну, значит оба лидера получают полные 4 очка, а оба подданных возвращаются в запас.':
    'Both ends of the road end at monasteries, so the road is complete: 4 tiles × 1 point = 4 points. The robbers are tied, so both leaders get the full 4 points and both followers return to the supply.',
  'Большинство в городе': 'Majority in a city',
  'Город рос несколько ходов, и на разных его участках стояли подданные разных игроков. Последний тайл закрыл город.':
    'The city grew over several turns, and followers of different players stood on its various segments. The last tile closed the city.',
  'Город из 4 тайлов закрыт новым тайлом снизу: 4 × 2 = 8 очков. Подданных «кораллового» больше (2 против 1), поэтому все 8 очков получает только он, а подданный «золотого» остаётся на поле.':
    'The 4-tile city is closed by a new tile from below: 4 × 2 = 8 points. Coral has more followers (2 against 1), so only coral gets all 8 points and the gold follower stays on the board.',
  'Незавершённые объекты в конце игры':
    'Incomplete features at the end of the game',
  'Колода закончилась, но город и дорога остались незавершёнными. Очки за них начисляются только при включённом финальном подсчёте.':
    'The deck has run out, but the city and road remain incomplete. They score only if final scoring is enabled.',
  'Зелёных рамок нет: город и дорога остались незавершёнными, поэтому при выключенном финальном подсчёте они не принесут ничего. При включённом подсчёте город даст 2 тайла × 1 + 1 герб × 1 = 3 очка, дорога — 2 тайла × 1 = 2 очка.':
    'There are no green borders: the city and road remain incomplete, so with final scoring disabled they score nothing. With final scoring enabled, the city gives 2 tiles × 1 + 1 coat of arms × 1 = 3 points, and the road gives 2 tiles × 1 = 2 points.',

  // Таверны и соборы.
  'Включение дополнения': 'Enabling the expansion',
  'Дополнение выбирается при создании партии. Оно добавляет 18 тайлов, в том числе таверны на дорогах и соборы в городах, и по одному большому подданному каждому игроку. Правила выкладывания тайлов, обычных подданных, большинства и хода остаются теми же.':
    'The expansion is selected when creating the game. It adds 18 tiles, including inns on roads and cathedrals in cities, and one big follower to each player. The rules for placing tiles, ordinary followers, majority, and turns remain the same.',
  'Особые тайлы дополнения': 'Special expansion tiles',
  'Изгиб с таверной': 'Curve with an inn',
  'Прямая с таверной': 'Straight with an inn',
  'Перекрёсток с таверной': 'Crossroads with an inn',
  Собор: 'Cathedral',
  'Собор и герб': 'Cathedral and coat of arms',
  Таверны: 'Inns',
  'Таверна принадлежит всей дороге, в которую входит соответствующий тайл. Завершённая дорога с одной или несколькими тавернами приносит 2 очка за каждый тайл дороги вместо 1. Несколько таверн на одной дороге не складываются: бонус засчитывается один раз, поэтому дорога всегда считается по 2 очка за тайл. Если дорога с таверной не завершена к концу партии, при финальном подсчёте она приносит 0 очков. Без включённого финального подсчёта за незавершённую дорогу очки не начисляются в любом случае.':
    'An inn belongs to the entire road that includes its tile. A completed road with one or more inns scores 2 points for each road tile instead of 1. Several inns on one road do not stack: the bonus is counted once, so the road always scores 2 points per tile. If a road with an inn is incomplete at the end of the game, it scores 0 points during final scoring. Without final scoring enabled, an incomplete road never scores.',
  Соборы: 'Cathedrals',
  'В завершённом городе с собором каждый тайл города и каждый герб приносят по 3 очка вместо обычных 2. Например, город из 2 тайлов с 1 гербом даёт (2 + 1) × 3 = 9 очков. Незавершённый город с собором приносит 0 очков при финальном подсчёте. Несколько соборов в одном городе не увеличивают награду: каждый тайл и герб всё равно оцениваются по 3 очка.':
    'In a completed city with a cathedral, each city tile and each coat of arms gives 3 points instead of the usual 2. For example, a 2-tile city with 1 coat of arms gives (2 + 1) × 3 = 9 points. An incomplete city with a cathedral scores 0 points during final scoring. Several cathedrals in one city do not increase the reward: each tile and coat of arms is still worth 3 points.',
  'Какое издание правил действует': 'Which edition of the rules applies',
  'Дополнение играется по правилам второго издания. В переиздании для третьего издания (2025) финальный подсчёт изменили: незавершённая дорога с таверной приносит 1 очко за тайл, а незавершённый город с собором — 1 очко за тайл и 1 за герб, как у обычных объектов. Там же появились особые тайлы с короткими дорогами. В этой игре действуют цифры из таблицы ниже: 0 очков за незавершённые дорогу с таверной и город с собором.':
    'The expansion is played by the second-edition rules. In the reprint for the third edition (2025), final scoring was changed: an incomplete road with an inn scores 1 point per tile, and an incomplete city with a cathedral scores 1 point per tile and 1 per coat of arms, like ordinary features. Special tiles with short roads also appeared there. In this game the numbers from the table below apply: 0 points for an incomplete road with an inn and an incomplete city with a cathedral.',
  'Большой подданный ставится на дорогу, город, монастырь или сад по обычным правилам и занимает одну фишку хода. Он не удваивает получаемые владельцем очки: при победе в большинстве владелец получает полную награду объекта. При определении большинства на дороге или в городе он считается за двух обычных подданных — этого достаточно, чтобы перевесить соперника с одним. На монастыре и саду подсчёт идёт по каждому подданному отдельно, поэтому сила большого подданного на награду не влияет. При завершении объекта большой подданный возвращается в запас.':
    "A big follower is placed on a road, city, monastery, or garden by the usual rules and counts as one placement. It does not double the points its owner receives: when winning the majority, the owner gets the full reward of the feature. When determining the majority on a road or in a city it counts as two ordinary followers — enough to outweigh an opponent with one. In a monastery and garden scoring is per follower, so the big follower's strength does not affect the reward. When the feature is completed, the big follower returns to the supply.",
  'Тактика и риск тупиков в дополнении':
    'Tactics and the risk of dead ends in the expansion',
  'Не выставляйте подданного на дорогу с таверной, если у неё уже мало вариантов завершения: незавершённая таверна не принесёт очков даже при включённом финальном подсчёте.':
    'Do not place a follower on a road with an inn if it already has few ways to be completed: an incomplete inn scores nothing even with final scoring enabled.',
  'Не присоединяйте собор к городу, который трудно закрыть. Незавершённый город с собором оценивается в 0, включая тайлы и гербы.':
    'Do not attach a cathedral to a city that is hard to close. An incomplete city with a cathedral is worth 0, including its tiles and coat of arms.',
  'Перед размещением тайла с таверной или собором проверьте все стороны и будущие места продолжения. Тайлы дополнения могут сделать фрагмент карты плотнее, но не отменяют запрет несовпадающих граней.':
    'Before placing a tile with an inn or cathedral, check all sides and future continuation places. Expansion tiles can make the map denser but do not lift the ban on mismatched edges.',
  'Пример неудачной линии: открыть дорогу в единственный свободный коридор, затем занять этот коридор монастырём или другим объектом. Размещение может быть полностью легальным, однако закрывающего дорогу места больше не останется; с таверной такая ошибка особенно дорога.':
    'An example of a bad line: open a road into the only free corridor, then occupy that corridor with a monastery or another feature. The placement may be completely legal, but no place to close the road will remain; with an inn such a mistake is especially costly.',
  'Очки с дополнением': 'Scoring with the expansion',
  Завершён: 'Completed',
  'Не завершён в конце партии': 'Incomplete at the end of the game',
  'Обычная дорога': 'Ordinary road',
  '1 очко за тайл': '1 point per tile',
  '1 очко за тайл при финальном подсчёте':
    '1 point per tile during final scoring',
  'Дорога с таверной': 'Road with an inn',
  '2 очка за тайл': '2 points per tile',
  '0 очков': '0 points',
  'Обычный город': 'Ordinary city',
  '2 за тайл и 2 за герб': '2 per tile and 2 per coat of arms',
  '1 за тайл и 1 за герб при финальном подсчёте':
    '1 per tile and 1 per coat of arms during final scoring',
  'Город с собором': 'City with a cathedral',
  '3 очка за каждый тайл и герб': '3 points for each tile and coat of arms',

  // Принцесса и дракон.
  'Дополнение второго издания': 'Second edition expansion',
  'Дополнение выбирается при создании партии. В колоду добавляются тайлы с принцессой, драконом и вулканами. Базовые правила выкладывания тайлов, размещения подданных и начисления очков сохраняются, если ниже не указано иное.':
    'The expansion is selected when creating the game. Tiles with the princess, dragon, and volcanoes are added to the deck. The base rules for placing tiles and followers and awarding points remain in effect unless stated otherwise below.',
  'В этой игре используется второе издание «Принцессы и дракона» (C2). В нём есть принцесса, дракон, фея и магический портал. Правила ниже описывают именно этот набор.':
    'This game uses the second edition of Princess and Dragon (C2). It includes the princess, the dragon, the fairy, and the magic portal. The rules below describe exactly this set.',
  'Тайлы с особыми символами': 'Tiles with special symbols',
  Принцесса: 'Princess',
  Дракон: 'Dragon',
  Вулкан: 'Volcano',
  'Магический портал': 'Magic portal',
  'Шесть шагов по прямой': 'Six steps in a straight line',
  'Дракон начинает на вулкане и проходит по непрерывному участку дороги. Число 0 отмечает вулкан, числа 1–6 — последовательные шаги.':
    'The dragon starts on a volcano and moves along a continuous road segment. The number 0 marks the volcano, numbers 1–6 mark successive steps.',
  'Коралловая точка показывает подданного до прихода дракона. На шаге 2 дракон входит на его тайл: фишка снимается и возвращается в запас (показано под схемой).':
    'The coral dot shows a follower before the dragon arrives. On step 2 the dragon enters its tile: the piece is removed and returned to the supply (shown under the diagram).',
  'Маршрут с поворотами': 'Route with turns',
  'Дракон движется от вулкана вниз, затем направо, снова вниз и ещё раз направо по соседним тайлам.':
    'The dragon moves from the volcano down, then right, down again, and right once more along adjacent tiles.',
  'Тайлы соприкасаются сторонами с совместимым ландшафтом; маршрут дракона при этом может пересекать дороги, города и поля.':
    'The tiles touch by sides with compatible landscape; the dragon route may cross roads, cities, and fields.',
  'Раннее завершение в тупике': 'Early finish at a dead end',
  'Вокруг вулкана — компактный городской участок. После трёх шагов дракон оказывается окружён уже посещёнными тайлами.':
    'Around the volcano is a compact city area. After three steps the dragon is surrounded by already visited tiles.',
  'Числа показывают порядок движения. Из тайла 3 все выложенные соседи — вулкан и тайлы шагов 1 и 2 — уже посещены, поэтому движение заканчивается раньше шести шагов.':
    'The numbers show the movement order. From tile 3 all placed neighbors — the volcano and the tiles of steps 1 and 2 — have already been visited, so the movement ends before six steps.',
  'Если вы выложили тайл с принцессой и он продолжает город, где есть хотя бы один рыцарь, вы можете убрать одного рыцаря на выбор (включая своего) и вернуть его владельцу. Действие не обязательное: если в городе нет рыцарей, способность не применяется и штрафа нет. Выбор делаете вы, поэтому в городе с несколькими рыцарями вы решаете, кого именно отогнать, и ничто не мешает расчистить город от собственного рыцаря. Принцесса смотрит только на тот город, к которому примыкает городской фрагмент с её символом: если на тайле есть второй, отдельный город, рыцари из него не страдают. Если этот фрагмент соединяет два отдельных города в один, принцесса может убрать любого рыцаря из объединённого города.':
    'If you place a princess tile that continues a city with at least one knight, you may remove one knight of your choice (including your own) and return it to its owner. The action is optional: if there are no knights in the city, the ability is not used and there is no penalty. You choose, so in a city with several knights you decide who is driven out, and nothing prevents you from clearing the city of your own knight. The princess looks only at the city to which the city segment with her symbol is attached: if the tile has a second, separate city, its knights are unaffected. If this segment joins two separate cities into one, the princess may remove any knight from the joined city.',
  'Штраф за применение': 'Penalty for using it',
  'После того как принцесса забрала рыцаря, свою фишку на этот тайл поставить уже нельзя — даже на дорогу или монастырь в других его частях. Ход на этом заканчивается. Если рыцарей в городе не было и способность не применялась, штрафа нет.':
    'After the princess removes a knight, you can no longer place your piece on this tile — even on a road or monastery in its other parts. The turn ends there. If there were no knights in the city and the ability was not used, there is no penalty.',
  Фея: 'Fairy',
  'Вместо выставления подданного переместите фею к одному из своих подданных на доске. Это действие завершает ход. После вулкана перемещение феи необязательно: можно переместить её или просто закончить ход. В начале каждого своего хода, пока связанный подданный остаётся на поле, вы получаете 1 очко. Когда подсчитывается объект или поле с этим подданным, его владелец дополнительно получает 3 очка независимо от большинства. Если подданный уходит с поля, связь с феей прекращается, но сама фея остаётся на своей клетке и защищает её от дракона.':
    'Instead of placing a follower, move the fairy to one of your followers on the board. This action ends the turn. After a volcano, moving the fairy is optional: you may move it or simply end the turn. At the start of each of your turns, while the linked follower remains on the board, you get 1 point. When a feature or field with this follower is scored, its owner additionally gets 3 points regardless of the majority. If the follower leaves the board, the link with the fairy ends, but the fairy stays on its cell and protects it from the dragon.',
  'Выложив тайл с порталом, вы можете поставить доступную фишку на этот или любой ранее выложенный тайл. Выбирайте только незавершённый и свободный объект или доступный регион поля; обычные ограничения по типу фишки и запасу сохраняются. На клетку с драконом ставить подданного нельзя.':
    "When you place a portal tile, you may place an available piece on this tile or any previously placed tile. Choose only an incomplete and unoccupied feature or an available field region; the usual restrictions on piece type and supply remain. A follower cannot be placed on the dragon's cell.",
  'Пробуждение и движение дракона': 'Awakening and movement of the dragon',
  'До появления первого вулкана дракон не участвует в игре. Если вытянут тайл с драконом, он возвращается в случайное место колоды, а игрок берёт следующий подходящий тайл.':
    'Before the first volcano appears, the dragon does not participate in the game. If a dragon tile is drawn, it is returned to a random place in the deck and the player draws the next suitable tile.',
  'Первый выложенный вулкан пробуждает дракона: поставьте его на этот тайл. На только что выложенный вулкан подданного поставить нельзя.':
    'The first volcano placed awakens the dragon: place it on this tile. A follower cannot be placed on the volcano just laid.',
  'После пробуждения каждый выложенный тайл с символом дракона запускает его движение. Сначала игрок заканчивает обычные действия на выложенном тайле, включая необязательное размещение подданного.':
    'After awakening, each placed tile with the dragon symbol triggers its movement. First the player finishes the usual actions on the placed tile, including the optional follower placement.',
  'Дракон перемещается до 6 раз по вертикали или горизонтали на соседний уже выложенный тайл. Первый шаг выбирает игрок, выложивший тайл с драконом; следующие шаги по очереди выбирают остальные игроки.':
    'The dragon moves up to 6 times vertically or horizontally to an adjacent already placed tile. The first step is chosen by the player who placed the dragon tile; subsequent steps are chosen in turn by the other players.',
  'В рамках одного движения нельзя повторно посещать тайл. Если допустимых соседних тайлов не осталось, движение заканчивается раньше шести шагов.':
    'During one movement a tile cannot be visited twice. If no legal adjacent tiles remain, the movement ends before six steps.',
  'При каждом обычном шаге дракон съедает подданных на тайле: все они возвращаются владельцам без начисления очков. Фея защищает всех подданных на своей клетке; дракон не может на неё шагнуть.':
    'On each ordinary step the dragon eats the followers on the tile: all of them return to their owners without scoring. The fairy protects all followers on its cell; the dragon cannot step onto it.',
  'Новый вулкан мгновенно переносит дракона на себя. Телепортация не снимает подданных с прежней позиции; они могут быть съедены позднее, если дракон наступит на этот тайл обычным шагом.':
    'A new volcano instantly teleports the dragon onto itself. Teleportation does not remove followers from the previous position; they may be eaten later if the dragon steps onto that tile with an ordinary step.',
  'Важно различать шаг и телепортацию':
    'It is important to distinguish a step from teleportation',
  'Подданных дракон снимает только при обычном перемещении на тайл. Появление нового вулкана лишь меняет позицию дракона и само по себе никого не возвращает в запас.':
    "The dragon removes followers only during an ordinary move onto a tile. The appearance of a new volcano only changes the dragon's position and by itself returns no one to the supply.",

  // Река.
  'Включение и начало партии': 'Enabling and starting the game',
  'Дополнение выбирается при создании партии. Оно заменяет обычный стартовый тайл истоком A и добавляет 11 тайлов реки в начало колоды; конечное озеро L всегда выкладывается последним. После озера начинается обычная колода. Дополнение можно использовать вместе с «Тавернами и соборами».':
    'The expansion is selected when creating the game. It replaces the usual starting tile with spring A and adds 11 river tiles to the top of the deck; the final lake L is always placed last. After the lake the regular deck begins. The expansion can be used together with Inns and Cathedrals.',
  'Тайлы реки': 'River tiles',
  'Исток с мостом': 'Spring with a bridge',
  'Изгиб у города': 'Curve by a city',
  'Прямая между городами': 'Straight between cities',
  Прямая: 'Straight',
  Изгиб: 'Curve',
  'Изгиб у дома': 'Curve by a house',
  'Монастырь и мост': 'Monastery and bridge',
  'Изгиб с дорогой': 'Curve with a road',
  'Изгиб у сада': 'Curve by a garden',
  'Мост и таверна': 'Bridge and inn',
  'Озеро и монастырь': 'Lake and monastery',
  'Как выкладывать реку': 'How to place the river',
  'Каждый речной тайл должен продолжать единственный открытый конец русла. Стороны реки должны соединяться, а стороны ландшафта соседних тайлов — совпадать по обычным правилам.':
    'Each river tile must continue the single open end of the riverbed. River sides must connect, and the landscape sides of adjacent tiles must match by the usual rules.',
  'Русло может поворачивать, но не может дважды повернуть в одну сторону подряд — река не должна течь вспять. На практике это значит, что русло от истока всегда продолжается вправо или вниз по полю: вернуться к уже пройденному участку и замкнуть петлю нельзя.':
    'The riverbed may turn, but it cannot turn the same way twice in a row — the river must not flow backwards. In practice this means the riverbed from the spring always continues right or down the field: it cannot return to an already passed segment and close a loop.',
  'Сначала выкладываются все речные тайлы, последним — озеро L. До озера обычные тайлы ставить нельзя; после озера оставшиеся речные тайлы убираются из колоды, и игра продолжается по базовым правилам.':
    'First all river tiles are placed, with lake L last. Ordinary tiles cannot be placed before the lake; after the lake the remaining river tiles are removed from the deck and the game continues by the base rules.',
  'Река сама по себе не приносит очков, и подданных на русло ставить нельзя. Дороги и города на речных тайлах считаются как обычно; монастырь на H или L и сад на J также используют обычные правила подсчёта.':
    'The river itself scores no points, and followers cannot be placed on the riverbed. Roads and cities on river tiles score as usual; the monastery on H or L and the garden on J also use the usual scoring rules.',
  'Отличие от настольной игры: реку обязательно нужно достроить':
    'Difference from the board game: the river must be completed',
  'В настольной игре, если русло зашло в тупик и ни один речной тайл не подходит, озеро можно не выкладывать: тайл убирают из игры, берут другой, и партия продолжается с «дырой» в реке. Здесь речные тайлы выдаются строго по порядку, озеро — последним, и пропустить их нельзя: пока озеро не выложено, обычный тайл тоже поставить нельзя. Поэтому реку нужно вести так, чтобы у русла всегда оставалось продолжение, — не заводите его в узкие проходы и не прижимайте к уже занятым клеткам.':
    'In the board game, if the riverbed reaches a dead end and no river tile fits, the lake may be skipped: the tile is removed, another is drawn, and the game continues with a "hole" in the river. Here river tiles are dealt strictly in order, the lake last, and they cannot be skipped: until the lake is placed, an ordinary tile cannot be placed either. So the river must be led so that the riverbed always has a continuation — do not lead it into narrow passages or press it against already occupied cells.',
  'Особые речные тайлы': 'Special river tiles',
  'На тайле K мост соединяет дорогу с таверной и действует по правилам дополнения «Таверны и соборы». На тайле H расположен монастырь и мост, а на конечном тайле L — озеро с монастырём. Поля и фермеры в онлайн-версии не реализованы.':
    'On tile K a bridge connects a road with an inn and works by the Inns and Cathedrals rules. Tile H has a monastery and a bridge, and the final tile L has a lake with a monastery. Fields and farmers are not implemented in the online version.',
}

function translate(value: string): string {
  return TRANSLATIONS[value] ?? value
}

function localizeExample(example: RulesExample): RulesExample {
  return {
    ...example,
    title: translate(example.title),
    ...(example.description !== undefined
      ? { description: translate(example.description) }
      : {}),
    ...(example.caption !== undefined
      ? { caption: translate(example.caption) }
      : {}),
  }
}

function localizeTilesRow(row: RulesTilesRow): RulesTilesRow {
  return {
    ...row,
    ...(row.title !== undefined ? { title: translate(row.title) } : {}),
    ...(row.labels
      ? {
          labels: row.labels.map((label) =>
            label === null ? null : translate(label)
          ),
        }
      : {}),
  }
}

function localizeBlock(block: RulesBlock): RulesBlock {
  switch (block.type) {
    case 'paragraph':
      return {
        ...block,
        text: translate(block.text),
        ...(block.title !== undefined ? { title: translate(block.title) } : {}),
      }
    case 'list':
      return {
        ...block,
        items: block.items.map(translate),
        ...(block.title !== undefined ? { title: translate(block.title) } : {}),
      }
    case 'callout':
      return {
        ...block,
        text: translate(block.text),
        ...(block.title !== undefined ? { title: translate(block.title) } : {}),
      }
    case 'table':
      return {
        ...block,
        head: block.head.map(translate),
        rows: block.rows.map((row) => row.map(translate)),
        ...(block.title !== undefined ? { title: translate(block.title) } : {}),
      }
    case 'example':
      return { ...localizeExample(block), type: 'example' }
    case 'tiles-row':
      return { ...localizeTilesRow(block), type: 'tiles-row' }
    default:
      return block
  }
}

function localizeSection(section: RulesSection): RulesSection {
  return {
    ...section,
    title: translate(section.title),
    blocks: section.blocks.map(localizeBlock),
  }
}

/** Возвращает документ правил с текстами на английском языке. */
export function localizeRulesDocument(doc: RulesDocument): RulesDocument {
  return {
    ...doc,
    title: translate(doc.title),
    ...(doc.subtitle !== undefined
      ? { subtitle: translate(doc.subtitle) }
      : {}),
    sections: doc.sections.map(localizeSection),
  }
}
