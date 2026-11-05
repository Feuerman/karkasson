const FORMAT_CHARACTER_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x206f],
  [0xfeff, 0xfeff],
]

/**
 * Управляющие и невидимые форматные символы, которые ломают отображение имён
 * и идентификаторов. Обычные пробелы, табы и переводы строк допустимы:
 * вызывающий код схлопывает их отдельно.
 */
export function hasControlOrFormatCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    const isControl =
      code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d
    if (isControl) return true
    if (
      FORMAT_CHARACTER_RANGES.some(([min, max]) => code >= min && code <= max)
    ) {
      return true
    }
  }
  return false
}
