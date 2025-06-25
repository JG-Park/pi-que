'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { errorHandler, ErrorCategory, ErrorSeverity } from '../../utils/common/error-handler';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorId: string, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  category?: ErrorCategory;
  showRetry?: boolean;
  retryable?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { category = ErrorCategory.UNKNOWN, onError } = this.props;

    // Create error through our error handler
    const appError = errorHandler.createError(
      'REACT_ERROR_BOUNDARY',
      error.message,
      category,
      ErrorSeverity.HIGH,
      {
        retryable: this.props.retryable ?? false,
        metadata: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
          timestamp: new Date().toISOString()
        }
      }
    );

    this.setState({ errorId: appError.id });

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught an Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('App Error ID:', appError.id);
      console.groupEnd();
    }
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    });
  };

  render() {
    const { hasError, error, errorId } = this.state;
    const { children, fallback, showRetry = true } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback && errorId) {
        return fallback(error, errorId, this.retry);
      }

      // Default fallback UI
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center max-w-md">
            <div className="text-red-600 mb-4">
              <svg 
                className="w-12 h-12 mx-auto mb-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>
            
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              문제가 발생했습니다
            </h3>
            
            <p className="text-red-600 text-sm mb-4">
              이 구성 요소를 로드하는 중 오류가 발생했습니다.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <details className="text-left mb-4">
                <summary className="text-red-700 font-medium cursor-pointer mb-2">
                  개발자 정보
                </summary>
                <div className="bg-red-100 p-3 rounded text-xs font-mono text-red-800 overflow-auto">
                  <div className="mb-2">
                    <strong>오류 ID:</strong> {errorId}
                  </div>
                  <div className="mb-2">
                    <strong>메시지:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>스택:</strong>
                      <pre className="whitespace-pre-wrap text-xs mt-1">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {showRetry && (
              <button
                onClick={this.retry}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                다시 시도
              </button>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Specialized error boundaries for different parts of the app
export function YouTubeErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      category={ErrorCategory.YOUTUBE_API}
      retryable={true}
      fallback={(error, errorId, retry) => (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-center max-w-md">
            <div className="text-yellow-600 mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              YouTube 비디오 로드 실패
            </h3>
            <p className="text-yellow-600 text-sm mb-4">
              YouTube 비디오를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={retry}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ProjectErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      category={ErrorCategory.PROJECT_MANAGEMENT}
      retryable={false}
      fallback={(error, errorId, retry) => (
        <div className="min-h-[200px] flex flex-col items-center justify-center p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-center max-w-md">
            <div className="text-blue-600 mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              프로젝트 로드 실패
            </h3>
            <p className="text-blue-600 text-sm mb-4">
              프로젝트 데이터를 불러오는 중 문제가 발생했습니다.
            </p>
            <button
              onClick={retry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
} 