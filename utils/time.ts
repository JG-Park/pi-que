export function timeToSeconds(timeStr: string): number {
  const parts = timeStr.split(":").map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return Number.parseInt(timeStr) || 0
}

export function secondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

export function validateTimeRange(startTime: string, endTime: string, videoDuration: number): string | null {
  const startSeconds = timeToSeconds(startTime)
  const endSeconds = timeToSeconds(endTime)

  if (startSeconds < 0 || endSeconds < 0) {
    return "시간은 0보다 커야 합니다."
  }

  if (startSeconds > videoDuration || endSeconds > videoDuration) {
    return `시간은 영상 길이(${secondsToTime(videoDuration)})를 초과할 수 없습니다.`
  }

  if (startSeconds >= endSeconds) {
    return "시작 시간은 종료 시간보다 작아야 합니다."
  }

  return null
}
