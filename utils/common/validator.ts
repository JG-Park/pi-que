export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export type ValidatorRule = 
  | 'required'
  | 'email'
  | 'url'
  | 'number'
  | 'positive'
  | 'youtube'
  | { minLength: number }
  | { maxLength: number }
  | { pattern: RegExp }
  | { custom: (value: any) => ValidationResult };

export class Validator {
  /**
   * 단일 값에 대한 유효성 검사
   */
  static validate(value: any, rules: ValidatorRule[]): ValidationResult {
    for (const rule of rules) {
      const result = this.applyRule(value, rule);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  }

  /**
   * 규칙 적용
   */
  private static applyRule(value: any, rule: ValidatorRule): ValidationResult {
    if (rule === 'required') {
      return this.validateRequired(value);
    }
    
    if (rule === 'email') {
      return this.validateEmail(value);
    }
    
    if (rule === 'url') {
      return this.validateUrl(value);
    }
    
    if (rule === 'number') {
      return this.validateNumber(value);
    }
    
    if (rule === 'positive') {
      return this.validatePositive(value);
    }
    
    if (rule === 'youtube') {
      return this.validateYouTubeUrl(value);
    }
    
    if (typeof rule === 'object') {
      if ('minLength' in rule) {
        return this.validateMinLength(value, rule.minLength);
      }
      
      if ('maxLength' in rule) {
        return this.validateMaxLength(value, rule.maxLength);
      }
      
      if ('pattern' in rule) {
        return this.validatePattern(value, rule.pattern);
      }
      
      if ('custom' in rule) {
        return rule.custom(value);
      }
    }
    
    return { isValid: true };
  }

  /**
   * 필수 값 검증
   */
  private static validateRequired(value: any): ValidationResult {
    if (value === null || value === undefined || value === '') {
      return { isValid: false, message: '필수 항목입니다.' };
    }
    return { isValid: true };
  }

  /**
   * 이메일 형식 검증
   */
  private static validateEmail(value: string): ValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { isValid: false, message: '올바른 이메일 형식이 아닙니다.' };
    }
    return { isValid: true };
  }

  /**
   * URL 형식 검증
   */
  private static validateUrl(value: string): ValidationResult {
    try {
      new URL(value);
      return { isValid: true };
    } catch {
      return { isValid: false, message: '올바른 URL 형식이 아닙니다.' };
    }
  }

  /**
   * 숫자 형식 검증
   */
  private static validateNumber(value: any): ValidationResult {
    if (isNaN(Number(value))) {
      return { isValid: false, message: '숫자여야 합니다.' };
    }
    return { isValid: true };
  }

  /**
   * 양수 검증
   */
  private static validatePositive(value: any): ValidationResult {
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      return { isValid: false, message: '양수여야 합니다.' };
    }
    return { isValid: true };
  }

  /**
   * YouTube URL 검증
   */
  private static validateYouTubeUrl(value: string): ValidationResult {
    const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(value)) {
      return { isValid: false, message: '올바른 YouTube URL이 아닙니다.' };
    }
    return { isValid: true };
  }

  /**
   * 최소 길이 검증
   */
  private static validateMinLength(value: string, minLength: number): ValidationResult {
    if (value.length < minLength) {
      return { isValid: false, message: `최소 ${minLength}자 이상이어야 합니다.` };
    }
    return { isValid: true };
  }

  /**
   * 최대 길이 검증
   */
  private static validateMaxLength(value: string, maxLength: number): ValidationResult {
    if (value.length > maxLength) {
      return { isValid: false, message: `최대 ${maxLength}자까지 입력 가능합니다.` };
    }
    return { isValid: true };
  }

  /**
   * 패턴 검증
   */
  private static validatePattern(value: string, pattern: RegExp): ValidationResult {
    if (!pattern.test(value)) {
      return { isValid: false, message: '올바른 형식이 아닙니다.' };
    }
    return { isValid: true };
  }
} 