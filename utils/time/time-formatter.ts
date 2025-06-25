import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';

export interface TimeFormat {
  hours: number
  minutes: number
  seconds: number
}

export class TimeFormatter {
  /**
   * Convert seconds to MM:SS or HH:MM:SS format
   */
  static secondsToTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  /**
   * Convert time string (MM:SS or HH:MM:SS) to seconds
   */
  static timeToSeconds(timeString: string): number {
    const parts = timeString.split(':').map(part => parseInt(part, 10))
    
    if (parts.length === 2) {
      // MM:SS format
      const [minutes, seconds] = parts
      return minutes * 60 + seconds
    } else if (parts.length === 3) {
      // HH:MM:SS format
      const [hours, minutes, seconds] = parts
      return hours * 3600 + minutes * 60 + seconds
    }
    
    throw new Error('Invalid time format. Use MM:SS or HH:MM:SS')
  }

  /**
   * Parse time string into components
   */
  static parseTime(timeString: string): TimeFormat {
    const totalSeconds = this.timeToSeconds(timeString)
    
    return {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    }
  }

  /**
   * Format time object to string
   */
  static formatTime(time: TimeFormat): string {
    if (time.hours > 0) {
      return `${time.hours}:${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`
    }
    
    return `${time.minutes}:${time.seconds.toString().padStart(2, '0')}`
  }

  /**
   * Validate time range
   */
  static validateTimeRange(startTime: string, endTime: string, videoDuration?: number): boolean {
    try {
      const start = this.timeToSeconds(startTime)
      const end = this.timeToSeconds(endTime)
      
      if (start >= end) {
        return false
      }
      
      if (videoDuration && (start > videoDuration || end > videoDuration)) {
        return false
      }
      
      return true
    } catch {
      return false
    }
  }

  /**
   * Calculate duration between two time points
   */
  static calculateDuration(startTime: string, endTime: string): string {
    const start = this.timeToSeconds(startTime)
    const end = this.timeToSeconds(endTime)
    const duration = end - start
    
    return this.secondsToTime(duration)
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  static formatRelativeTime(date: string | Date): string {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      if (!isValid(dateObj)) {
        return '알 수 없음';
      }
      return formatDistanceToNow(dateObj, { addSuffix: true, locale: ko });
    } catch {
      return '알 수 없음';
    }
  }

  /**
   * Format absolute time (e.g., "2023-01-01 15:30")
   */
  static formatAbsoluteTime(date: string | Date, pattern: string = 'yyyy-MM-dd HH:mm'): string {
    try {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      if (!isValid(dateObj)) {
        return '알 수 없음';
      }
      return format(dateObj, pattern, { locale: ko });
    } catch {
      return '알 수 없음';
    }
  }
} 