/**
 * 초를 MM:SS 또는 HH:MM:SS 형식으로 변환합니다.
 * @param seconds - 변환할 초
 * @returns 형식화된 시간 문자열
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0 || !isFinite(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * 밀리초를 MM:SS 또는 HH:MM:SS 형식으로 변환합니다.
 * @param milliseconds - 변환할 밀리초
 * @returns 형식화된 시간 문자열
 */
export function formatDurationFromMs(milliseconds: number): string {
  return formatDuration(milliseconds / 1000);
}

/**
 * 시간 문자열을 초로 변환합니다.
 * @param timeString - MM:SS 또는 HH:MM:SS 형식의 시간 문자열
 * @returns 초 단위의 시간
 */
export function parseDuration(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') return 0;
  
  const parts = timeString.split(':').map(part => parseInt(part, 10));
  
  // Check for invalid numbers
  if (parts.some(part => isNaN(part))) return 0;
  
  if (parts.length === 2) {
    // MM:SS 형식
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS 형식
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  
  return 0;
} 