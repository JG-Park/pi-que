export interface VideoInfo {
  platform: 'youtube' | 'vimeo' | 'unknown';
  videoId: string;
  originalUrl: string;
  embedUrl?: string;
  thumbnailUrl?: string;
}

export interface ParseResult {
  success: boolean;
  data?: VideoInfo;
  error?: string;
}

export class VideoUrlParser {
  /**
   * 비디오 URL에서 정보 추출
   */
  static parse(url: string): ParseResult {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'URL이 필요합니다.' };
    }

    // YouTube URL 파싱 시도
    const youtubeResult = this.parseYouTube(url);
    if (youtubeResult.success) {
      return youtubeResult;
    }

    // Vimeo URL 파싱 시도
    const vimeoResult = this.parseVimeo(url);
    if (vimeoResult.success) {
      return vimeoResult;
    }

    return { success: false, error: '지원하지 않는 비디오 플랫폼입니다.' };
  }

  /**
   * YouTube URL 파싱
   */
  private static parseYouTube(url: string): ParseResult {
    const patterns = [
      // 일반 YouTube URL
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
      // 임베드 URL
      /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
      // 단축 URL
      /youtu\.be\/([a-zA-Z0-9_-]+)/,
      // 모바일 URL
      /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
      // YouTube 스튜디오 URL
      /studio\.youtube\.com\/video\/([a-zA-Z0-9_-]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        
        return {
          success: true,
          data: {
            platform: 'youtube',
            videoId,
            originalUrl: url,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
          }
        };
      }
    }

    return { success: false, error: '올바른 YouTube URL이 아닙니다.' };
  }

  /**
   * Vimeo URL 파싱
   */
  private static parseVimeo(url: string): ParseResult {
    const patterns = [
      // 일반 Vimeo URL
      /vimeo\.com\/(\d+)/,
      // Vimeo 플레이어 URL
      /player\.vimeo\.com\/video\/(\d+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        
        return {
          success: true,
          data: {
            platform: 'vimeo',
            videoId,
            originalUrl: url,
            embedUrl: `https://player.vimeo.com/video/${videoId}`
          }
        };
      }
    }

    return { success: false, error: '올바른 Vimeo URL이 아닙니다.' };
  }

  /**
   * YouTube 비디오 ID만 추출 (기존 호환성)
   */
  static extractYouTubeId(url: string): string | null {
    const result = this.parseYouTube(url);
    return result.success ? result.data!.videoId : null;
  }

  /**
   * URL이 지원되는 비디오 플랫폼인지 확인
   */
  static isSupported(url: string): boolean {
    return this.parse(url).success;
  }

  /**
   * 플랫폼 감지
   */
  static detectPlatform(url: string): 'youtube' | 'vimeo' | 'unknown' {
    const result = this.parse(url);
    return result.success ? result.data!.platform : 'unknown';
  }
} 