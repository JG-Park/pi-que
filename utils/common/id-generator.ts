export interface IdOptions {
  prefix?: string;
  length?: number;
  includeTimestamp?: boolean;
}

/**
 * 고유 ID 생성 유틸리티
 */
export class IdGenerator {
  private static counter = 0;

  /**
   * 간단한 고유 ID 생성 (UUID 대안)
   */
  static generate(options: IdOptions = {}): string {
    const { prefix = '', length = 8, includeTimestamp = false } = options;
    
    let id = '';
    
    // 접두사 추가
    if (prefix) {
      id += prefix + '_';
    }
    
    // 타임스탬프 추가 (옵션)
    if (includeTimestamp) {
      id += Date.now().toString(36) + '_';
    }
    
    // 랜덤 문자열 생성
    const randomPart = this.generateRandomString(length);
    id += randomPart;
    
    // 카운터 추가 (충돌 방지)
    id += '_' + (++this.counter).toString(36);
    
    return id;
  }

  /**
   * 숫자 ID 생성
   */
  static generateNumeric(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  /**
   * 짧은 ID 생성 (6자리)
   */
  static generateShort(): string {
    return this.generateRandomString(6);
  }

  /**
   * 프로젝트용 ID 생성
   */
  static generateProjectId(): string {
    return this.generate({ prefix: 'proj', length: 8, includeTimestamp: true });
  }

  /**
   * 세그먼트용 ID 생성
   */
  static generateSegmentId(): string {
    return this.generate({ prefix: 'seg', length: 6 });
  }

  /**
   * 랜덤 문자열 생성
   */
  private static generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * ID 유효성 검사
   */
  static isValidId(id: string): boolean {
    if (!id || typeof id !== 'string') {
      return false;
    }
    
    // 기본적인 ID 패턴 검사
    const pattern = /^[a-zA-Z0-9_-]+$/;
    return pattern.test(id) && id.length > 0;
  }

  /**
   * ID에서 접두사 추출
   */
  static extractPrefix(id: string): string | null {
    const match = id.match(/^([a-zA-Z]+)_/);
    return match ? match[1] : null;
  }

  /**
   * 타임스탬프가 포함된 ID인지 확인
   */
  static hasTimestamp(id: string): boolean {
    // 타임스탬프가 포함된 ID 패턴 검사
    const timestampPattern = /_[0-9a-z]+_[a-zA-Z0-9]+_[0-9a-z]+$/;
    return timestampPattern.test(id);
  }
} 