export interface DragItem {
  id: string
  index: number
  type: "segment" | "queue"
}

export const reorderArray = <T extends { id: string }>(array: T[], startIndex: number, endIndex: number): T[] => {
  const result = Array.from(array)
  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)
  return result
}
