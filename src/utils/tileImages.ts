import { TileId } from '@server/modules/types'

/** Относительные пути к изображениям тайлов по их id. */
const tileSources: Record<TileId, string> = {
  [TileId.A]: '../assets/tiles/Base_Game_C3_Tile_A.png',
  [TileId.B]: '../assets/tiles/Base_Game_C3_Tile_B.png',
  [TileId.C]: '../assets/tiles/Base_Game_C3_Tile_C.png',
  [TileId.D]: '../assets/tiles/Base_Game_C3_Tile_D.png',
  [TileId.E]: '../assets/tiles/Base_Game_C3_Tile_E.png',
  [TileId.F]: '../assets/tiles/Base_Game_C3_Tile_F.png',
  [TileId.G]: '../assets/tiles/Base_Game_C3_Tile_G.png',
  [TileId.H]: '../assets/tiles/Base_Game_C3_Tile_H.png',
  [TileId.I]: '../assets/tiles/Base_Game_C3_Tile_I.png',
  [TileId.J]: '../assets/tiles/Base_Game_C3_Tile_J.png',
  [TileId.K]: '../assets/tiles/Base_Game_C3_Tile_K.png',
  [TileId.L]: '../assets/tiles/Base_Game_C3_Tile_L.png',
  [TileId.M]: '../assets/tiles/Base_Game_C3_Tile_M.png',
  [TileId.N]: '../assets/tiles/Base_Game_C3_Tile_N.png',
  [TileId.O]: '../assets/tiles/Base_Game_C3_Tile_O.png',
  [TileId.P]: '../assets/tiles/Base_Game_C3_Tile_P.png',
  [TileId.Q]: '../assets/tiles/Base_Game_C3_Tile_Q.png',
  [TileId.R]: '../assets/tiles/Base_Game_C3_Tile_R.png',
  [TileId.S]: '../assets/tiles/Base_Game_C3_Tile_S.png',
  [TileId.T]: '../assets/tiles/Base_Game_C3_Tile_T.png',
  [TileId.U]: '../assets/tiles/Base_Game_C3_Tile_U.png',
  [TileId.V]: '../assets/tiles/Base_Game_C3_Tile_V.png',
  [TileId.W]: '../assets/tiles/Base_Game_C3_Tile_W.png',
  [TileId.X]: '../assets/tiles/Base_Game_C3_Tile_X.png',
  [TileId.IAC_A]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_A.png',
  [TileId.IAC_B]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_B.png',
  [TileId.IAC_C]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_C.png',
  [TileId.IAC_D]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_D.png',
  [TileId.IAC_E]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_E.png',
  [TileId.IAC_F]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_F.png',
  [TileId.IAC_G]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_G.png',
  [TileId.IAC_H]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_H.png',
  [TileId.IAC_I]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_I.png',
  [TileId.IAC_J]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_J.png',
  [TileId.IAC_Ka]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Ka.png',
  [TileId.IAC_Kb]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Kb.png',
  [TileId.IAC_L]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_L.png',
  [TileId.IAC_M]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_M.png',
  [TileId.IAC_N]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_N.png',
  [TileId.IAC_O]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_O.png',
  [TileId.IAC_P]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_P.png',
  [TileId.IAC_Q]:
    '../assets/tiles/inns_and_cathedrals/Inns_And_Cathedrals_C3_Tile_Q.png',
  [TileId.RIVER_A]: '../assets/tiles/river/River_I_C3_Tile_A.png',
  [TileId.RIVER_B]: '../assets/tiles/river/River_I_C3_Tile_B.png',
  [TileId.RIVER_C]: '../assets/tiles/river/River_I_C3_Tile_C.png',
  [TileId.RIVER_D]: '../assets/tiles/river/River_I_C3_Tile_D.png',
  [TileId.RIVER_F]: '../assets/tiles/river/River_I_C3_Tile_F.png',
  [TileId.RIVER_G]: '../assets/tiles/river/River_I_C3_Tile_G.png',
  [TileId.RIVER_H]: '../assets/tiles/river/River_I_C3_Tile_H.png',
  [TileId.RIVER_I]: '../assets/tiles/river/River_I_C3_Tile_I.png',
  [TileId.RIVER_J]: '../assets/tiles/river/River_I_C3_Tile_J.png',
  [TileId.RIVER_K]: '../assets/tiles/river/River_I_C3_Tile_K.png',
  [TileId.RIVER_L]: '../assets/tiles/river/River_I_C3_Tile_L.png',
  [TileId.PAD_A]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_A.jpg',
  [TileId.PAD_B]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_B.jpg',
  [TileId.PAD_C]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_C.jpg',
  [TileId.PAD_D]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_D.jpg',
  [TileId.PAD_E]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_E.jpg',
  [TileId.PAD_F]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_F.jpg',
  [TileId.PAD_G]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_G.jpg',
  [TileId.PAD_H]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_H.jpg',
  [TileId.PAD_I]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_I.jpg',
  [TileId.PAD_J]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_J.jpg',
  [TileId.PAD_K]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_K.jpg',
  [TileId.PAD_L]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_L.jpg',
  [TileId.PAD_M]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_M.jpg',
  [TileId.PAD_N]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_N.jpg',
  [TileId.PAD_O]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_O.jpg',
  [TileId.PAD_P]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_P.jpg',
  [TileId.PAD_Q]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_Q.jpg',
  [TileId.PAD_R]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_R.jpg',
  [TileId.PAD_S]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_S.jpg',
  [TileId.PAD_T]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_T.jpg',
  [TileId.PAD_U]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_U.jpg',
  [TileId.PAD_V]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_V.jpg',
  [TileId.PAD_W]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_W.jpg',
  [TileId.PAD_X]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_X.jpg',
  [TileId.PAD_Y]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_Y.jpg',
  [TileId.PAD_Z]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_Z.jpg',
  [TileId.PAD_1]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_1.jpg',
  [TileId.PAD_2]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_2.jpg',
  [TileId.PAD_3]:
    '../assets/tiles/princess_and_dragon/Princess_And_Dragon_C2_Tile_3.jpg',
}

/**
 * Динамические импорты тайлов: Vite обрабатывает `import.meta.glob` при сборке,
 * копирует файлы в `dist/assets` и возвращает функции, которые лениво загружают
 * resolved URL изображения. Ключ — относительный путь из `tileSources`.
 */
const tileModules = import.meta.glob('../assets/tiles/**/*.{png,jpg}', {
  query: '?url',
  import: 'default',
  eager: false,
}) as Record<string, () => Promise<string>>

/** Кэш загруженных URL тайлов: ключ — id тайла, значение — resolved URL. */
const loadedTileUrls: Map<TileId, string> = new Map()

/** Тайлы, загрузка которых уже идёт (чтобы не запускать повторно). */
const loadingTiles: Set<TileId> = new Set()

/**
 * Загружает изображение тайла лениво. Возвращает Promise, который разрешается
 * resolved URL изображения после загрузки модуля. Повторные вызовы для одного
 * тайла возвращают кэшированный результат. Изображение копируется в
 * `dist/assets` при сборке, но загружается браузером только когда тайл впервые
 * появляется на доске.
 */
export async function loadTileImage(
  tileId: TileId
): Promise<string | undefined> {
  const cached = loadedTileUrls.get(tileId)
  if (cached) return cached

  if (loadingTiles.has(tileId)) {
    // Ждём завершения уже начатой загрузки того же тайла.
    while (loadingTiles.has(tileId)) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return loadedTileUrls.get(tileId)
  }

  const source = tileSources[tileId]
  if (!source) return undefined

  const load = tileModules[source]
  if (!load) return undefined

  loadingTiles.add(tileId)
  try {
    const url = await load()
    loadedTileUrls.set(tileId, url)
    return url
  } finally {
    loadingTiles.delete(tileId)
  }
}

/** Количество закешированных тайлов (для мониторинга и тестов). */
export function loadedTilesCount(): number {
  return loadedTileUrls.size
}
