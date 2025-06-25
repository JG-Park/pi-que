import { useEffect, useState, useCallback } from 'react';
import { 
  errorHandler, 
  AppError, 
  ErrorCategory, 
  ErrorSeverity,
  ErrorHandlerOptions
} from '../../utils/common/error-handler';

export interface UseErrorHandlerReturn {
  errors: AppError[];
  lastError: AppError | null;
  clearErrors: (category?: ErrorCategory) => void;
  handleError: (error: unknown, category?: ErrorCategory, options?: Partial<ErrorHandlerOptions>) => AppError;
  createError: (
    code: string,
    message: string,
    category?: ErrorCategory,
    severity?: ErrorSeverity,
    options?: Partial<ErrorHandlerOptions>
  ) => AppError;
  hasError: (category?: ErrorCategory) => boolean;
  getErrorsByCategory: (category: ErrorCategory) => AppError[];
  isRetryable: (errorId: string) => boolean;
  retry: <T>(errorId: string, operation: () => Promise<T>, options?: { maxRetries?: number; delay?: number }) => Promise<T>;
}

export function useErrorHandler(categories?: ErrorCategory[]): UseErrorHandlerReturn {
  const [errors, setErrors] = useState<AppError[]>([]);
  const [lastError, setLastError] = useState<AppError | null>(null);

  // Subscribe to error updates
  useEffect(() => {
    const unsubscribe = errorHandler.subscribe((error: AppError) => {
      if (!categories || categories.includes(error.category)) {
        setErrors(prevErrors => {
          const updated = [...prevErrors, error];
          // Keep only last 50 errors to prevent memory leaks
          return updated.slice(-50);
        });
        setLastError(error);
      }
    });

    // Initialize with existing errors
    const existingErrors = categories 
      ? categories.flatMap(cat => errorHandler.getErrorsByCategory(cat))
      : [];
    
    if (existingErrors.length > 0) {
      setErrors(existingErrors.slice(-50));
      setLastError(existingErrors[existingErrors.length - 1] || null);
    }

    return unsubscribe;
  }, [categories]);

  const clearErrors = useCallback((category?: ErrorCategory) => {
    errorHandler.clearErrors(category);
    if (category) {
      setErrors(prevErrors => prevErrors.filter(error => error.category !== category));
      // Update lastError if it was from the cleared category
      if (lastError && lastError.category === category) {
        const remainingErrors = errors.filter(error => error.category !== category);
        setLastError(remainingErrors[remainingErrors.length - 1] || null);
      }
    } else {
      setErrors([]);
      setLastError(null);
    }
  }, [lastError, errors]);

  const handleError = useCallback((
    error: unknown, 
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    options: Partial<ErrorHandlerOptions> = {}
  ): AppError => {
    return errorHandler.handleError(error, category, options);
  }, []);

  const createError = useCallback((
    code: string,
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: Partial<ErrorHandlerOptions> = {}
  ): AppError => {
    return errorHandler.createError(code, message, category, severity, options);
  }, []);

  const hasError = useCallback((category?: ErrorCategory): boolean => {
    if (category) {
      return errors.some(error => error.category === category);
    }
    return errors.length > 0;
  }, [errors]);

  const getErrorsByCategory = useCallback((category: ErrorCategory): AppError[] => {
    return errors.filter(error => error.category === category);
  }, [errors]);

  const isRetryable = useCallback((errorId: string): boolean => {
    const error = errorHandler.getError(errorId);
    return !!(error?.retryable && (error.retryCount ?? 0) < (error.maxRetries ?? 3));
  }, []);

  const retry = useCallback(async <T>(
    errorId: string, 
    operation: () => Promise<T>, 
    options?: { maxRetries?: number; delay?: number }
  ): Promise<T> => {
    return errorHandler.retry(errorId, operation, options);
  }, []);

  return {
    errors,
    lastError,
    clearErrors,
    handleError,
    createError,
    hasError,
    getErrorsByCategory,
    isRetryable,
    retry
  };
}

// Specialized hooks for specific error categories
export function useNetworkErrorHandler() {
  return useErrorHandler([ErrorCategory.NETWORK]);
}

export function useYouTubeErrorHandler() {
  return useErrorHandler([ErrorCategory.YOUTUBE_API]);
}

export function useProjectErrorHandler() {
  return useErrorHandler([ErrorCategory.PROJECT_MANAGEMENT]);
}

export function useAuthErrorHandler() {
  return useErrorHandler([ErrorCategory.AUTHENTICATION, ErrorCategory.AUTHORIZATION]);
}

export function useValidationErrorHandler() {
  return useErrorHandler([ErrorCategory.VALIDATION]);
} 