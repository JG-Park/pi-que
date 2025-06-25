import {
  AppError as CustomAppError,
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  BusinessLogicError,
  ConfigurationError,
  ExternalServiceError,
  NetworkError,
  FileError,
  isAppError as isCustomAppError,
  getErrorType,
  getErrorMessage,
  isOperationalError
} from './errors';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  YOUTUBE_API = 'youtube_api',
  PROJECT_MANAGEMENT = 'project_management',
  UNKNOWN = 'unknown'
}

export interface AppError {
  id: string;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  stack?: string;
  metadata?: Record<string, any>;
  userMessage?: string;
  retryable?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface ErrorHandlerOptions {
  logToConsole?: boolean;
  showToUser?: boolean;
  throwError?: boolean;
  retryable?: boolean;
  maxRetries?: number;
  metadata?: Record<string, any>;
  includeStack?: boolean;
  reportToService?: boolean;
}

export interface ErrorInfo {
  message: string;
  code?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  timestamp: Date;
  stack?: string;
  type?: string;
  isOperational?: boolean;
}

export class ErrorHandler {
  private static options: ErrorHandlerOptions = {
    logToConsole: true,
    includeStack: true,
    reportToService: false,
  };

  private errors: Map<string, AppError> = new Map();
  private listeners: ((error: AppError) => void)[] = [];

  /**
   * 설정 업데이트
   */
  static configure(options: Partial<ErrorHandlerOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 에러 처리 - 커스텀 에러 클래스 지원 추가
   */
  static handle(error: Error | string | CustomAppError, context?: Record<string, any>): ErrorInfo {
    let errorType = 'UnknownError';
    let isOperational = false;
    let customContext: Record<string, any> = {};

    // 커스텀 에러 클래스인지 확인하고 추가 정보 추출
    if (isCustomAppError(error)) {
      errorType = getErrorType(error);
      isOperational = isOperationalError(error);
      customContext = {
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        context: error.context,
        ...this.extractCustomErrorDetails(error)
      };
    }

    const errorInfo: ErrorInfo = {
      message: getErrorMessage(error),
      severity: this.determineSeverity(error),
      context: { ...customContext, ...context },
      timestamp: new Date(),
      stack: typeof error === 'object' ? error.stack : undefined,
      type: errorType,
      isOperational
    };

    // 콘솔 로깅
    if (this.options.logToConsole) {
      this.logToConsole(errorInfo);
    }

    // 외부 서비스 리포팅 (추후 구현)
    if (this.options.reportToService) {
      this.reportToService(errorInfo);
    }

    return errorInfo;
  }

  /**
   * 커스텀 에러 클래스별 추가 세부사항 추출
   */
  private static extractCustomErrorDetails(error: CustomAppError): Record<string, any> {
    const details: Record<string, any> = {};

    if (error instanceof ApiError) {
      details.endpoint = error.endpoint;
      details.method = error.method;
      details.responseData = error.responseData;
    } else if (error instanceof ValidationError) {
      details.field = error.field;
      details.value = error.value;
      details.validationRules = error.validationRules;
    } else if (error instanceof AuthenticationError) {
      details.authMethod = error.authMethod;
      details.userId = error.userId;
    } else if (error instanceof AuthorizationError) {
      details.requiredPermission = error.requiredPermission;
      details.userPermissions = error.userPermissions;
      details.resource = error.resource;
    } else if (error instanceof NotFoundError) {
      details.resourceType = error.resourceType;
      details.resourceId = error.resourceId;
    } else if (error instanceof BusinessLogicError) {
      details.businessRule = error.businessRule;
      details.affectedEntities = error.affectedEntities;
    } else if (error instanceof ConfigurationError) {
      details.configKey = error.configKey;
      details.expectedType = error.expectedType;
    } else if (error instanceof ExternalServiceError) {
      details.serviceName = error.serviceName;
      details.serviceEndpoint = error.serviceEndpoint;
      details.serviceResponse = error.serviceResponse;
    } else if (error instanceof NetworkError) {
      details.networkDetails = error.networkDetails;
    } else if (error instanceof FileError) {
      details.fileName = error.fileName;
      details.filePath = error.filePath;
      details.operation = error.operation;
    }

    return details;
  }

  /**
   * 심각도 결정 - 커스텀 에러 클래스 지원
   */
  private static determineSeverity(error: Error | string | CustomAppError): ErrorInfo['severity'] {
    // 커스텀 에러 클래스의 statusCode를 기반으로 심각도 결정
    if (isCustomAppError(error)) {
      const statusCode = error.statusCode;
      
      if (statusCode >= 500) return 'critical';
      if (statusCode >= 400 && statusCode < 500) return 'medium';
      if (statusCode >= 300) return 'low';
      
      // 에러 타입별 특별 처리
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return 'high';
      }
      if (error instanceof ValidationError) {
        return 'low';
      }
      if (error instanceof NetworkError || error instanceof ExternalServiceError) {
        return 'medium';
      }
      if (error instanceof ConfigurationError) {
        return 'critical';
      }
    }

    // 기존 로직 유지
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'medium';
    }

    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return 'low';
    }

    if (lowerMessage.includes('auth') || lowerMessage.includes('permission')) {
      return 'high';
    }

    if (lowerMessage.includes('critical') || lowerMessage.includes('fatal')) {
      return 'critical';
    }

    return 'medium';
  }

  /**
   * 콘솔 로깅 - 개선된 형식
   */
  private static logToConsole(errorInfo: ErrorInfo): void {
    const { message, severity, context, timestamp, type, isOperational } = errorInfo;
    
    const logMethod = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    
    // 로그 형식 개선
    const prefix = `[${timestamp.toISOString()}] ${severity.toUpperCase()}`;
    const typeInfo = type ? ` [${type}]` : '';
    const operationalInfo = isOperational !== undefined ? (isOperational ? ' [OPERATIONAL]' : ' [PROGRAMMING]') : '';
    
    console[logMethod](`${prefix}${typeInfo}${operationalInfo}: ${message}`);
    
    if (context) {
      console[logMethod]('Context:', context);
    }

    if (this.options.includeStack && errorInfo.stack) {
      console[logMethod]('Stack:', errorInfo.stack);
    }
  }

  /**
   * 외부 서비스 리포팅 (추후 구현)
   */
  private static reportToService(errorInfo: ErrorInfo): void {
    // TODO: 외부 에러 트래킹 서비스 연동 (Sentry 등)
    console.log('Error reported to service:', {
      message: errorInfo.message,
      type: errorInfo.type,
      severity: errorInfo.severity,
      isOperational: errorInfo.isOperational,
      timestamp: errorInfo.timestamp
    });
  }

  /**
   * 비동기 에러 처리
   */
  static async handleAsync<T>(
    promise: Promise<T>,
    context?: Record<string, any>
  ): Promise<[T | null, ErrorInfo | null]> {
    try {
      const result = await promise;
      return [result, null];
    } catch (error) {
      const errorInfo = this.handle(error as Error, context);
      return [null, errorInfo];
    }
  }

  /**
   * 함수 실행 래퍼
   */
  static wrap<T extends (...args: any[]) => any>(
    fn: T,
    context?: Record<string, any>
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handle(error as Error, context);
        throw error;
      }
    }) as T;
  }

  /**
   * 유효성 검사 에러 - 커스텀 ValidationError 사용
   */
  static validation(message: string, field?: string, value?: any): ErrorInfo {
    const validationError = new ValidationError(message, field, value);
    return this.handle(validationError);
  }

  /**
   * 네트워크 에러 - 커스텀 NetworkError 사용
   */
  static network(message: string, url?: string, status?: number): ErrorInfo {
    const networkError = new NetworkError(message, { url, retryCount: 0 });
    return this.handle(networkError);
  }

  /**
   * 인증 에러 - 커스텀 AuthenticationError 사용
   */
  static auth(message: string, authMethod?: string, userId?: string): ErrorInfo {
    const authError = new AuthenticationError(message, authMethod, userId);
    return this.handle(authError);
  }

  /**
   * API 에러 - 커스텀 ApiError 사용
   */
  static api(message: string, statusCode: number, endpoint?: string, method?: string): ErrorInfo {
    const apiError = new ApiError(message, statusCode, endpoint, method);
    return this.handle(apiError);
  }

  /**
   * 권한 에러 - 커스텀 AuthorizationError 사용
   */
  static authorization(message: string, requiredPermission?: string, resource?: string): ErrorInfo {
    const authzError = new AuthorizationError(message, requiredPermission, [], resource);
    return this.handle(authzError);
  }

  /**
   * 리소스 없음 에러 - 커스텀 NotFoundError 사용
   */
  static notFound(message: string, resourceType?: string, resourceId?: string | number): ErrorInfo {
    const notFoundError = new NotFoundError(message, resourceType, resourceId);
    return this.handle(notFoundError);
  }

  createError(
    code: string,
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: Partial<ErrorHandlerOptions> = {}
  ): AppError {
    const error: AppError = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      code,
      message,
      category,
      severity,
      timestamp: new Date(),
      userMessage: this.getUserFriendlyMessage(code, category),
      retryable: options.retryable ?? false,
      retryCount: 0,
      maxRetries: options.maxRetries ?? 3,
      metadata: options.metadata
    };

    this.errors.set(error.id, error);
    this.notifyListeners(error);

    if (options.logToConsole !== false) {
      this.logError(error);
    }

    if (options.throwError) {
      throw new Error(error.message);
    }

    return error;
  }

  handleError(
    error: unknown,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    options: Partial<ErrorHandlerOptions> = {}
  ): AppError {
    let appError: AppError;

    if (this.isAppError(error)) {
      appError = error;
    } else if (error instanceof Error) {
      appError = this.createError(
        'GENERIC_ERROR',
        error.message,
        category,
        ErrorSeverity.MEDIUM,
        { ...options, metadata: { stack: error.stack } }
      );
    } else {
      appError = this.createError(
        'UNKNOWN_ERROR',
        'An unknown error occurred',
        category,
        ErrorSeverity.MEDIUM,
        options
      );
    }

    return appError;
  }

  isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'id' in error &&
      'code' in error &&
      'message' in error &&
      'category' in error &&
      'severity' in error
    );
  }

  getError(id: string): AppError | undefined {
    return this.errors.get(id);
  }

  getErrorsByCategory(category: ErrorCategory): AppError[] {
    return Array.from(this.errors.values()).filter(error => error.category === category);
  }

  clearErrors(category?: ErrorCategory): void {
    if (category) {
      Array.from(this.errors.entries()).forEach(([id, error]) => {
        if (error.category === category) {
          this.errors.delete(id);
        }
      });
    } else {
      this.errors.clear();
    }
  }

  subscribe(listener: (error: AppError) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(error: AppError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error handler listener:', err);
      }
    });
  }

  private logError(error: AppError): void {
    const logMethod = this.getLogMethod(error.severity);
    logMethod(
      `[${error.category.toUpperCase()}] ${error.code}: ${error.message}`,
      {
        id: error.id,
        timestamp: error.timestamp,
        severity: error.severity,
        metadata: error.metadata,
        stack: error.stack
      }
    );
  }

  private getLogMethod(severity: ErrorSeverity): Console['log'] {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return console.error;
      case ErrorSeverity.MEDIUM:
        return console.warn;
      case ErrorSeverity.LOW:
      default:
        return console.log;
    }
  }

  private getUserFriendlyMessage(code: string, category: ErrorCategory): string {
    const messages: Record<string, string> = {
      // Network errors
      NETWORK_ERROR: '네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.',
      TIMEOUT_ERROR: '요청 시간이 초과되었습니다. 다시 시도해주세요.',
      
      // YouTube API errors
      YOUTUBE_API_ERROR: 'YouTube 비디오를 불러오는 중 오류가 발생했습니다.',
      YOUTUBE_VIDEO_NOT_FOUND: '해당 YouTube 비디오를 찾을 수 없습니다.',
      YOUTUBE_QUOTA_EXCEEDED: 'YouTube API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.',
      
      // Project management errors
      PROJECT_SAVE_ERROR: '프로젝트 저장 중 오류가 발생했습니다.',
      PROJECT_LOAD_ERROR: '프로젝트를 불러오는 중 오류가 발생했습니다.',
      
      // Authentication errors
      AUTH_ERROR: '인증에 실패했습니다. 다시 로그인해주세요.',
      
      // Validation errors
      VALIDATION_ERROR: '입력한 정보를 확인해주세요.',
      
      // Generic
      GENERIC_ERROR: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.'
    };

    return messages[code] || messages.UNKNOWN_ERROR;
  }

  // Retry mechanism
  async retry<T>(
    errorId: string,
    operation: () => Promise<T>,
    options: { maxRetries?: number; delay?: number } = {}
  ): Promise<T> {
    const error = this.getError(errorId);
    if (!error || !error.retryable) {
      throw new Error('Error is not retryable');
    }

    const maxRetries = options.maxRetries ?? error.maxRetries ?? 3;
    const delay = options.delay ?? 1000;
    const retryCount = error.retryCount ?? 0;

    if (retryCount >= maxRetries) {
      throw new Error('Maximum retry attempts exceeded');
    }

    try {
      const result = await operation();
      this.clearErrors(); // Clear on success
      return result;
    } catch (err) {
      error.retryCount = (error.retryCount ?? 0) + 1;
      
      if (error.retryCount < maxRetries) {
        await this.sleep(delay * error.retryCount); // Exponential backoff
        return this.retry(errorId, operation, options);
      } else {
        throw err;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler();

// Helper functions for common error types
export const createNetworkError = (message: string, options?: Partial<ErrorHandlerOptions>) =>
  errorHandler.createError('NETWORK_ERROR', message, ErrorCategory.NETWORK, ErrorSeverity.HIGH, {
    retryable: true,
    ...options
  });

export const createYouTubeError = (message: string, options?: Partial<ErrorHandlerOptions>) =>
  errorHandler.createError('YOUTUBE_API_ERROR', message, ErrorCategory.YOUTUBE_API, ErrorSeverity.MEDIUM, {
    retryable: true,
    ...options
  });

export const createProjectError = (message: string, options?: Partial<ErrorHandlerOptions>) =>
  errorHandler.createError('PROJECT_SAVE_ERROR', message, ErrorCategory.PROJECT_MANAGEMENT, ErrorSeverity.HIGH, options);

export const createValidationError = (message: string, field?: string, options?: Partial<ErrorHandlerOptions>) =>
  errorHandler.createError('VALIDATION_ERROR', message, ErrorCategory.VALIDATION, ErrorSeverity.MEDIUM, {
    ...options,
    metadata: { field, ...options?.metadata }
  });

export const createAuthError = (message: string, options?: Partial<ErrorHandlerOptions>) =>
  errorHandler.createError('AUTH_ERROR', message, ErrorCategory.AUTHENTICATION, ErrorSeverity.HIGH, options); 