import { PointDirection, SideName, TileId } from '@server/modules/types'
import { RulesMarkerKind, type RulesExample } from '../types'
import { cell, completed, empty, garden, grid, invalid, rot } from '../examples'

/** Клетка-тайл без маркеров. */
const tile = (id: TileId, rotation?: 0 | 90 | 180 | 270) =>
  cell(rot(id, rotation))

/** Верное соединение дорожных граней: три тайла прямой дороги. */
export const roadConnectionExample: RulesExample = {
  id: 'road-connection',
  title: 'Дорога к дороге',
  description:
    'Новый тайл с дорогой прилегает к тайлам с дорогой: грани «дорога» должны совпадать.',
  grid: grid([
    [empty, tile(TileId.U), empty],
    [
      empty,
      cell(
        rot(TileId.U),
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'coral',
          direction: SideName.North,
        }
      ),
      empty,
    ],
    [empty, tile(TileId.U), empty],
  ]),
  caption:
    'Все прилегающие грани — дороги. Синяя пунктирная рамка — тайл только что выложен, цветная точка — подданный.',
}

/** Неверное размещение: дорога прилегает к полю. */
export const wrongPlacementExample: RulesExample = {
  id: 'wrong-placement',
  title: 'Так ставить нельзя',
  description:
    'Грань «дорога» не может прилегать к грани «поле». Красный крестик отмечает несовпадение.',
  grid: grid([
    [empty, tile(TileId.U), empty],
    [empty, invalid(rot(TileId.E), SideName.North), empty],
  ]),
  caption: 'Новый тайл можно повернуть или положить в другое место, но не так.',
  intentionalMismatch: true,
}

/** Завершённый монастырь: все 8 соседних клеток заняты. */
export const completedMonasteryExample: RulesExample = {
  id: 'completed-monastery',
  title: 'Завершённый монастырь',
  description:
    'Монастырь завершается, когда вокруг него выложены все 8 соседних тайлов.',
  grid: grid([
    [tile(TileId.B), tile(TileId.A, 180), tile(TileId.B)],
    [
      tile(TileId.A, 90),
      cell(
        rot(TileId.B),
        { kind: RulesMarkerKind.Completed },
        {
          kind: RulesMarkerKind.Follower,
          color: 'coral',
          direction: PointDirection.Center,
        }
      ),
      tile(TileId.A, 270),
    ],
    [tile(TileId.B), tile(TileId.A), tile(TileId.B)],
  ]),
  caption:
    'Монастырь + 8 окружающих тайлов = 9 очков. Зелёная рамка отмечает весь завершённый объект, коралловая точка — монаха.',
}

/** Два города, соприкасающиеся только углами, — это разные города. */
export const cityCornersExample: RulesExample = {
  id: 'city-corners',
  title: 'Углы не соединяют',
  description:
    'Город с городом соединяются только сторонами. Соприкосновение углами и пустые клетки между тайлами связи не дают.',
  grid: grid([
    [
      cell(rot(TileId.E), {
        kind: RulesMarkerKind.Follower,
        color: 'coral',
        direction: SideName.North,
      }),
      empty,
    ],
    [empty, cell(rot(TileId.E, 180))],
  ]),
  caption:
    'Два одно-гранных города касаются только углом, поэтому это два независимых города. Подданный «кораллового» не мешает другому игроку поставить фишку во второй город.',
}

/** Дорога завершена, потому что оба конца упираются в перекрёсток и монастырь. */
export const roadCrossroadsExample: RulesExample = {
  id: 'road-crossroads',
  title: 'Дорога упирается в перекрёсток',
  description:
    'Перекрёсток обрывает дорогу так же, как город или монастырь. Сам перекрёсток при этом даёт три отдельные незавершённые дороги.',
  grid: grid([
    [cell(rot(TileId.W), { kind: RulesMarkerKind.Completed })],
    [
      cell(
        rot(TileId.U),
        { kind: RulesMarkerKind.Completed },
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'gold',
          direction: SideName.North,
        }
      ),
    ],
    [cell(rot(TileId.A, 180), { kind: RulesMarkerKind.Completed })],
  ]),
  caption:
    'Один конец дороги упирается в перекрёсток, другой — в монастырь: дорога из 2 тайлов завершена и даёт 2 очка. Три дороги самого перекрёстка (на восток, запад и продолжение на север) остаются незавершёнными, пока их концы не упрутся в города или монастыри.',
}

/** Дорога замкнулась в кольцо — оба конца соединились сами с собой. */
export const roadLoopExample: RulesExample = {
  id: 'road-loop',
  title: 'Дорога замкнулась в кольцо',
  description:
    'Четыре изогнутых тайла образуют замкнутую петлю. Ни один конец не упирается в город или монастырь, но дорога всё равно завершена.',
  grid: grid([
    [
      cell(rot(TileId.V, 270), { kind: RulesMarkerKind.Completed }),
      cell(rot(TileId.V), { kind: RulesMarkerKind.Completed }),
    ],
    [
      cell(
        rot(TileId.V, 90),
        { kind: RulesMarkerKind.Completed },
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'skyblue',
          direction: SideName.North,
        }
      ),
      cell(rot(TileId.V, 180), { kind: RulesMarkerKind.Completed }),
    ],
  ]),
  caption:
    'Дорога со всех сторон окружена полями, но кольцо замкнуто: 4 тайла × 1 очко = 4 очка. Подданный «небесно-голубого» получает очки и возвращается в запас.',
}

/** Отзыв аббата из незавершённого сада даёт очки за объект и соседей. */
export const abbotRecallExample: RulesExample = {
  id: 'abbot-recall',
  title: 'Отзыв аббата',
  description:
    'Вместо того чтобы ставить подданного, игрок забирает своего аббата из незавершённого сада и получает очки за сам сад и за каждый занятый тайл вокруг.',
  grid: grid([
    [empty, tile(TileId.C), empty],
    [
      tile(TileId.C),
      cell(garden(TileId.I), {
        kind: RulesMarkerKind.Follower,
        color: 'teal',
        direction: PointDirection.Center,
      }),
      tile(TileId.B),
    ],
    [empty, tile(TileId.B), tile(TileId.B)],
  ]),
  returnedFollowers: ['teal'],
  caption:
    'Вокруг сада занято 5 из 8 клеток, поэтому отзыв аббата даёт 1 очко за сам сад и по 1 за каждый соседний тайл — всего 6 очков. Аббат возвращается в запас, ход при этом не тратится. Два верхних тайла примыкают к саду гранями города: сад лежит на тайле, у которого есть и сад, и две городские стороны.',
}

/** Сад с аббатом и несколькими соседними тайлами. */
export const partialGardenExample: RulesExample = {
  id: 'partial-garden',
  title: 'Сад и его окрестность',
  description:
    'Сад отмечен золотым значком на тайле. Аббат ставится в центр сада и остаётся там до отзыва или конца партии.',
  grid: grid([
    [empty, cell(rot(TileId.C)), empty],
    [
      cell(rot(TileId.C)),
      cell(garden(TileId.I), {
        kind: RulesMarkerKind.Follower,
        color: 'teal',
        direction: PointDirection.Center,
      }),
      cell(rot(TileId.B)),
    ],
    [empty, cell(rot(TileId.B)), empty],
  ]),
  caption:
    'Сад и 4 занятых соседних клетки дают аббату 5 очков при отзыве или финальном подсчёте.',
}

/** Завершённый сад со всеми восемью соседними тайлами. */
export const completedGardenExample: RulesExample = {
  id: 'completed-garden',
  title: 'Завершённый сад',
  description:
    'Сад завершается, когда заняты все 8 клеток вокруг него. Значок сада показан на центральном тайле.',
  grid: grid([
    [tile(TileId.C), tile(TileId.C), tile(TileId.C)],
    [
      tile(TileId.C),
      cell(garden(TileId.R), {
        kind: RulesMarkerKind.Follower,
        color: 'teal',
        direction: PointDirection.Center,
      }),
      tile(TileId.C),
    ],
    [tile(TileId.I), tile(TileId.B), tile(TileId.J)],
  ]),
  caption:
    'Полностью окружённый сад даёт аббату 9 очков при отзыве или финальном подсчёте.',
}

/** Завершённая дорога между двумя монастырями. */
export const completedRoadExample: RulesExample = {
  id: 'completed-road-ring',
  title: 'Завершённая дорога',
  description:
    'Дорога завершена, когда оба её конца упираются в монастырь, город или перекрёсток.',
  grid: grid([
    [cell(rot(TileId.A), { kind: RulesMarkerKind.Completed })],
    [
      cell(
        rot(TileId.U),
        { kind: RulesMarkerKind.Completed },
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'gold',
          direction: SideName.North,
        }
      ),
    ],
    [cell(rot(TileId.A, 180), { kind: RulesMarkerKind.Completed })],
  ]),
  caption: 'Три тайла дороги дают 3 очка.',
}

/** Завершённый отдельный город на тайле-крепости. */
export const completedCityExample: RulesExample = {
  id: 'completed-city-ring',
  title: 'Завершённый город-крепость',
  description:
    'На тайле-крепости весь участок города объединён внутри одной плитки и не имеет открытых продолжений.',
  grid: grid([
    [empty, tile(TileId.H), empty],
    [
      tile(TileId.D, 90),
      cell(rot(TileId.C), {
        kind: RulesMarkerKind.Follower,
        color: 'coral',
        direction: SideName.North,
      }),
      tile(TileId.I),
    ],
    [empty, tile(TileId.H), empty],
  ]),
  caption:
    'Город-крепость из 5 тайлов: 4 обычных 4*2 = 8 очков + 1 с гербом = 4 очка (2 за тайл + 2 за герб). Всего за город будет начислено 12 очков.',
}

/** Подданного нельзя ставить на объект, который уже занят. */
export const claimedObjectExample: RulesExample = {
  id: 'claimed-object',
  title: 'Занятый объект',
  description:
    'На один объект (здесь — одна дорога) можно поставить только одного подданного.',
  grid: grid([
    [empty, tile(TileId.U), empty],
    [
      empty,
      cell(rot(TileId.U), {
        kind: RulesMarkerKind.Follower,
        color: 'coral',
        direction: SideName.South,
      }),
      empty,
    ],
    [
      empty,
      cell(
        rot(TileId.U),
        { kind: RulesMarkerKind.New },
        { kind: RulesMarkerKind.Invalid, direction: SideName.North }
      ),
      empty,
    ],
  ]),
  caption:
    'Дорога уже занята подданным («коралловая» точка) — сюда ставить нельзя (красный крестик).',
}

/** Таверна повышает награду только за завершённую дорогу. */
export const innRoadExample: RulesExample = {
  id: 'inn-road',
  title: 'Таверна на дороге',
  description:
    'Таверна входит в одну дорогу с монастырями на её концах. Подданный может находиться на любом тайле этой дороги.',
  grid: grid([
    [cell(rot(TileId.A), { kind: RulesMarkerKind.Completed })],
    [
      cell(
        rot(TileId.IAC_B, 90),
        { kind: RulesMarkerKind.Completed },
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'gold',
          direction: SideName.North,
        }
      ),
    ],
    [cell(rot(TileId.A, 180), { kind: RulesMarkerKind.Completed })],
  ]),
  caption:
    'Завершённая дорога из 3 тайлов с таверной даёт 6 очков (3 × 2). Если бы дорога осталась незавершённой к концу партии, она принесла бы 0 очков.',
}

/** Две таверны на одной дороге дают бонус только один раз. */
export const twoInnsExample: RulesExample = {
  id: 'inn-twice',
  title: 'Две таверны на одной дороге',
  description:
    'Обе таверны принадлежат одной дороге, но удваивают её награду только один раз: дорога считается один раз по 2 очка за тайл.',
  grid: grid([
    [cell(rot(TileId.A, 270), { kind: RulesMarkerKind.Completed })],
    [
      cell(
        rot(TileId.IAC_B),
        { kind: RulesMarkerKind.Completed },
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'gold',
          direction: SideName.East,
        }
      ),
    ],
    [cell(rot(TileId.IAC_B, 180), { kind: RulesMarkerKind.Completed })],
    [cell(rot(TileId.A, 90), { kind: RulesMarkerKind.Completed })],
  ]),
  caption:
    'Дорога из 4 тайлов с двумя тавернами приносит 4 × 2 = 8 очков, а не 16. На двух средних тайлах есть ещё и сад — он считается по обычным правилам для садов.',
}

/** Большой подданный перевешивает обычного при споре за дорогу. */
export const bigFollowerRoadExample: RulesExample = {
  id: 'big-follower-road',
  title: 'Большой подданный на дороге',
  description:
    'Два участка дороги стали одной дорогой, и на каждом остался подданный. Большой подданный считается за двух и перевешивает соперника.',
  grid: grid([
    [
      cell(
        rot(TileId.A, 270),
        { kind: RulesMarkerKind.Completed },
        {
          kind: RulesMarkerKind.Follower,
          color: 'coral',
          direction: SideName.East,
          isBig: true,
        }
      ),
      cell(rot(TileId.U, 90), { kind: RulesMarkerKind.Completed }),
      cell(
        rot(TileId.U, 90),
        { kind: RulesMarkerKind.Completed },
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'skyblue',
          direction: SideName.East,
        }
      ),
      cell(rot(TileId.A, 90), { kind: RulesMarkerKind.Completed }),
    ],
  ]),
  caption:
    'Оба конца дороги упираются в монастыри, поэтому дорога из 4 тайлов завершена. У «кораллового» большой подданный — 2 голоса против 1 у «небесно-голубого», поэтому все 4 очка получает «коралловый», а подданный соперника остаётся на дороге.',
}

/** Собор умножает очки за завершённый город. */
export const cathedralCityExample: RulesExample = {
  id: 'cathedral-city',
  title: 'Собор в городе',
  description:
    'Собор — значок на городском тайле. Он усиливает весь город, к которому присоединён, а не только один тайл.',
  grid: grid([
    [empty, completed(rot(TileId.IAC_G, 270)), empty],
    [
      completed(rot(TileId.IAC_G, 180)),
      cell(
        rot(TileId.IAC_Ka),
        { kind: RulesMarkerKind.Completed },
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'coral',
          direction: SideName.North,
        }
      ),
      completed(rot(TileId.IAC_G)),
    ],
    [empty, completed(rot(TileId.IAC_G, 90)), empty],
  ]),
  caption:
    'Собор и четыре одно-гранных тайла замыкают город из 5 тайлов: каждый приносит по 3 очка, всего 5 × 3 = 15. Незавершённый город с собором приносит 0 очков при финальном подсчёте. Несколько соборов в одном городе не увеличивают награду.',
}

/** Большой подданный перевешивает одного обычного при подсчёте большинства в городе. */
export const bigFollowerExample: RulesExample = {
  id: 'big-follower-majority',
  title: 'Большой подданный',
  description:
    'Большого подданного можно поставить на любой объект вместо обычного. При споре за большинство он считается за двух: этого достаточно, чтобы обойти соперника с одной фишкой.',
  grid: grid([
    [
      empty,
      cell(rot(TileId.E, 180), {
        kind: RulesMarkerKind.Follower,
        color: 'skyblue',
        direction: SideName.South,
      }),
      empty,
    ],
    [
      cell(rot(TileId.E, 90)),
      cell(rot(TileId.C), {
        kind: RulesMarkerKind.Follower,
        color: 'coral',
        direction: SideName.North,
        isBig: true,
      }),
      cell(rot(TileId.E, 270)),
    ],
    [empty, cell(rot(TileId.E)), empty],
  ]),
  caption:
    'Подданные стояли на разных участках города, пока участки не соединились. Теперь у «кораллового» большой подданный — 2 голоса против 1 у «небесно-голубого». Город из 5 тайлов с одним гербом даёт победителю 5 × 2 + 2 = 12 очков, а подданный соперника остаётся на городе и очков не приносит.',
}

/** Позиция легальна, но намеренно оставляет объект без доступного продолжения. */
export const trappedObjectExample: RulesExample = {
  id: 'trapped-road-end',
  title: 'Открытая дорога под угрозой тупика',
  description:
    'Все три тайла дороги состыкованы правильно, но оба конца пока открыты. Это легальная незавершённая позиция: соперники могут занять свободные клетки, подходящие для продолжения.',
  grid: grid([
    [
      tile(TileId.U, 90),
      cell(
        rot(TileId.U, 90),
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'gold',
          direction: SideName.East,
        }
      ),
      tile(TileId.U, 90),
    ],
  ]),
  caption:
    'До вкладывания подданного оцените доступные продолжения. Если дорогу не удастся замкнуть до конца игры, финальная награда будет зависеть от включённого финального подсчёта.',
}

/** Два участка дороги соединились новым тайлом: разбойники разных игроков. */
export const sharedRoadExample: RulesExample = {
  id: 'shared-road',
  title: 'Две дороги стали одной',
  description:
    'Дороги, которые до этого шли отдельно, соединены новым тайлом. На общей дороге оказалось по разбойнику у каждого игрока.',
  grid: grid([
    [
      completed(rot(TileId.A, 270)),
      cell(
        rot(TileId.U, 90),
        { kind: RulesMarkerKind.Completed },
        {
          kind: RulesMarkerKind.Follower,
          color: 'coral',
          direction: SideName.East,
        }
      ),
      cell(
        rot(TileId.U, 90),
        { kind: RulesMarkerKind.Completed },
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'gold',
          direction: SideName.East,
        }
      ),
      completed(rot(TileId.A, 90)),
    ],
  ]),
  caption:
    'Оба конца дороги упираются в монастыри, поэтому дорога завершена: 4 тайла × 1 очко = 4 очка. Разбойников поровну, значит оба лидера получают полные 4 очка, а оба подданных возвращаются в запас.',
}

/** Город из четырёх тайлов, где подданных больше у одного игрока. */
export const sharedCityExample: RulesExample = {
  id: 'shared-city-majority',
  title: 'Большинство в городе',
  description:
    'Город рос несколько ходов, и на разных его участках стояли подданные разных игроков. Последний тайл закрыл город.',
  grid: grid([
    [
      empty,
      cell(rot(TileId.E, 180), {
        kind: RulesMarkerKind.Follower,
        color: 'gold',
        direction: SideName.South,
      }),
      empty,
      empty,
    ],
    [
      empty,
      cell(
        rot(TileId.N),
        { kind: RulesMarkerKind.Completed },
        {
          kind: RulesMarkerKind.Follower,
          color: 'coral',
          direction: SideName.East,
        }
      ),
      cell(
        rot(TileId.N, 180),
        { kind: RulesMarkerKind.Completed },
        {
          kind: RulesMarkerKind.Follower,
          color: 'coral',
          direction: SideName.South,
        }
      ),
      empty,
    ],
    [empty, empty, cell(rot(TileId.E), { kind: RulesMarkerKind.New }), empty],
  ]),
  caption:
    'Город из 4 тайлов закрыт новым тайлом снизу: 4 × 2 = 8 очков. Подданных «кораллового» больше (2 против 1), поэтому все 8 очков получает только он, а подданный «золотого» остаётся на поле.',
}

/** Незавершённые город и дорога: пример финального подсчёта. */
export const finalScoringExample: RulesExample = {
  id: 'final-scoring',
  title: 'Незавершённые объекты в конце игры',
  description:
    'Колода закончилась, но город и дорога остались незавершёнными. Очки за них начисляются только при включённом финальном подсчёте.',
  grid: grid([
    [
      cell(rot(TileId.M), {
        kind: RulesMarkerKind.Follower,
        color: 'coral',
        direction: SideName.North,
      }),
      cell(rot(TileId.E, 270)),
      empty,
      cell(rot(TileId.V, 180)),
      cell(
        rot(TileId.U, 90),
        { kind: RulesMarkerKind.New },
        {
          kind: RulesMarkerKind.Follower,
          color: 'gold',
          direction: SideName.East,
        }
      ),
      empty,
    ],
  ]),
  caption:
    'Зелёных рамок нет: город и дорога остались незавершёнными, поэтому при выключенном финальном подсчёте они не принесут ничего. При включённом подсчёте город даст 2 тайла × 1 + 1 герб × 1 = 3 очка, дорога — 2 тайла × 1 = 2 очка.',
}
