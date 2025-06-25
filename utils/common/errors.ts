/**
 * 커스텀 에러 클래스들
 * 애플리케이션에서 발생하는 다양한 유형의 에러를 분류하고 처리하기 위한 클래스들
 */

// 기본 애플리케이션 에러 클래스
export abstract class AppError extends Error {
  public readonly name: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.context = context;

    // Error.captureStackTrace가 존재하는 경우에만 사용
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

// API 관련 에러
export class ApiError extends AppError {
  public readonly endpoint?: string;
  public readonly method?: string;
  public readonly responseData?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    endpoint?: string,
    method?: string,
    responseData?: any,
    context?: Record<string, any>
  ) {
    super(message, statusCode, true, context);
    this.endpoint = endpoint;
    this.method = method;
    this.responseData = responseData;
  }

  static fromResponse(response: Response, endpoint?: string, method?: string, context?: Record<string, any>) {
    return new ApiError(
      `API 요청 실패: ${response.status} ${response.statusText}`,
      response.status,
      endpoint || response.url,
      method || 'GET',
      undefined,
      context
    );
  }
}

// 검증 관련 에러
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly value?: any;
  public readonly validationRules?: Record<string, any>;

  constructor(
    message: string,
    field?: string,
    value?: any,
    validationRules?: Record<string, any>,
    context?: Record<string, any>
  ) {
    super(message, 400, true, context);
    this.field = field;
    this.value = value;
    this.validationRules = validationRules;
  }
}

// 인증 관련 에러
export class AuthenticationError extends AppError {
  public readonly authMethod?: string;
  public readonly userId?: string;

  constructor(
    message: string = '인증이 필요합니다',
    authMethod?: string,
    userId?: string,
    context?: Record<string, any>
  ) {
    super(message, 401, true, context);
    this.authMethod = authMethod;
    this.userId = userId;
  }
}

// 권한 관련 에러
export class AuthorizationError extends AppError {
  public readonly requiredPermission?: string;
  public readonly userPermissions?: string[];
  public readonly resource?: string;

  constructor(
    message: string = '해당 작업을 수행할 권한이 없습니다',
    requiredPermission?: string,
    userPermissions?: string[],
    resource?: string,
    context?: Record<string, any>
  ) {
    super(message, 403, true, context);
    this.requiredPermission = requiredPermission;
    this.userPermissions = userPermissions;
    this.resource = resource;
  }
}

// 데이터 없음 에러
export class NotFoundError extends AppError {
  public readonly resourceType?: string;
  public readonly resourceId?: string | number;

  constructor(
    message: string = '요청한 리소스를 찾을 수 없습니다',
    resourceType?: string,
    resourceId?: string | number,
    context?: Record<string, any>
  ) {
    super(message, 404, true, context);
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

// 비즈니스 로직 에러
export class BusinessLogicError extends AppError {
  public readonly businessRule?: string;
  public readonly affectedEntities?: string[];

  constructor(
    message: string,
    businessRule?: string,
    affectedEntities?: string[],
    context?: Record<string, any>
  ) {
    super(message, 422, true, context);
    this.businessRule = businessRule;
    this.affectedEntities = affectedEntities;
  }
}

// 설정 관련 에러
export class ConfigurationError extends AppError {
  public readonly configKey?: string;
  public readonly expectedType?: string;

  constructor(
    message: string,
    configKey?: string,
    expectedType?: string,
    context?: Record<string, any>
  ) {
    super(message, 500, false, context);
    this.configKey = configKey;
    this.expectedType = expectedType;
  }
}

// 외부 서비스 관련 에러
export class ExternalServiceError extends AppError {
  public readonly serviceName?: string;
  public readonly serviceEndpoint?: string;
  public readonly serviceResponse?: any;

  constructor(
    message: string,
    serviceName?: string,
    serviceEndpoint?: string,
    serviceResponse?: any,
    context?: Record<string, any>
  ) {
    super(message, 502, true, context);
    this.serviceName = serviceName;
    this.serviceEndpoint = serviceEndpoint;
    this.serviceResponse = serviceResponse;
  }
}

// 네트워크 관련 에러
export class NetworkError extends AppError {
  public readonly networkDetails?: {
    url?: string;
    timeout?: number;
    retryCount?: number;
  };

  constructor(
    message: string = '네트워크 연결에 문제가 발생했습니다',
    networkDetails?: {
      url?: string;
      timeout?: number;
      retryCount?: number;
    },
    context?: Record<string, any>
  ) {
    super(message, 503, true, context);
    this.networkDetails = networkDetails;
  }
}

// 파일 관련 에러
export class FileError extends AppError {
  public readonly fileName?: string;
  public readonly filePath?: string;
  public readonly operation?: 'read' | 'write' | 'delete' | 'upload' | 'download';

  constructor(
    message: string,
    fileName?: string,
    filePath?: string,
    operation?: 'read' | 'write' | 'delete' | 'upload' | 'download',
    context?: Record<string, any>
  ) {
    super(message, 400, true, context);
    this.fileName = fileName;
    this.filePath = filePath;
    this.operation = operation;
  }
}

// 에러 타입 가드 함수들
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

export const isApiError = (error: any): error is ApiError => {
  return error instanceof ApiError;
};

export const isValidationError = (error: any): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isAuthenticationError = (error: any): error is AuthenticationError => {
  return error instanceof AuthenticationError;
};

export const isAuthorizationError = (error: any): error is AuthorizationError => {
  return error instanceof AuthorizationError;
};

export const isNotFoundError = (error: any): error is NotFoundError => {
  return error instanceof NotFoundError;
};

export const isBusinessLogicError = (error: any): error is BusinessLogicError => {
  return error instanceof BusinessLogicError;
};

export const isConfigurationError = (error: any): error is ConfigurationError => {
  return error instanceof ConfigurationError;
};

export const isExternalServiceError = (error: any): error is ExternalServiceError => {
  return error instanceof ExternalServiceError;
};

export const isNetworkError = (error: any): error is NetworkError => {
  return error instanceof NetworkError;
};

export const isFileError = (error: any): error is FileError => {
  return error instanceof FileError;
};

// 에러 유틸리티 함수들
export const getErrorType = (error: any): string => {
  if (isAppError(error)) {
    return error.constructor.name;
  }
  return 'UnknownError';
};

export const getErrorMessage = (error: any): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '알 수 없는 오류가 발생했습니다';
};

export const isOperationalError = (error: any): boolean => {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}; 