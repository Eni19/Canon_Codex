/**
 * Histórico de desfazer/refazer por estados completos. Cada ação concluída marca o estado
 * anterior; editar de novo depois de desfazer descarta o que podia ser refeito.
 */
export function createHistory<T>(limit = 200) {
  const undoStack: T[] = []
  let redoStack: T[] = []
  return {
    mark(before: T) {
      undoStack.push(before)
      if (undoStack.length > limit) undoStack.shift()
      redoStack = []
    },
    undo(current: T): T | null {
      const previous = undoStack.pop()
      if (previous === undefined) return null
      redoStack.push(current)
      return previous
    },
    redo(current: T): T | null {
      const next = redoStack.pop()
      if (next === undefined) return null
      undoStack.push(current)
      return next
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  }
}
export type History<T> = ReturnType<typeof createHistory<T>>
