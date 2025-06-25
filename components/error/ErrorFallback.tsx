'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { getErrorType, getErrorMessage, isAppError } from '@/utils/common/errors';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  resetKeys?: string[];
  showDetails?: boolean;
  onReport?: (error: Error) => void;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
  showDetails = false,
  onReport,
  severity = 'medium'
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);
  const [isReporting, setIsReporting] = React.useState(false);

  const errorType = getErrorType(error);
  const errorMessage = getErrorMessage(error);
  const isCustomError = isAppError(error);

  // 에러 심각도에 따른 UI 스타일
  const getSeverityStyles = () => {
    switch (severity) {
      case 'critical':
        return {
          containerClass: 'bg-red-50 border-red-300',
          iconClass: 'text-red-600',
          titleClass: 'text-red-800',
          messageClass: 'text-red-700'
        };
      case 'high':
        return {
          containerClass: 'bg-orange-50 border-orange-300',
          iconClass: 'text-orange-600',
          titleClass: 'text-orange-800',
          messageClass: 'text-orange-700'
        };
      case 'low':
        return {
          containerClass: 'bg-yellow-50 border-yellow-300',
          iconClass: 'text-yellow-600',
          titleClass: 'text-yellow-800',
          messageClass: 'text-yellow-700'
        };
      default: // medium
        return {
          containerClass: 'bg-red-50 border-red-200',
          iconClass: 'text-red-500',
          titleClass: 'text-red-800',
          messageClass: 'text-red-600'
        };
    }
  };

  const styles = getSeverityStyles();

  // 사용자 친화적 에러 메시지 생성
  const getUserFriendlyMessage = () => {
    if (isCustomError) {
      // 커스텀 에러 타입별 메시지
      switch (errorType) {
        case 'ValidationError':
          return '입력한 정보에 문제가 있습니다. 다시 확인해 주세요.';
        case 'AuthenticationError':
          return '로그인이 필요하거나 인증에 문제가 있습니다.';
        case 'AuthorizationError':
          return '해당 작업을 수행할 권한이 없습니다.';
        case 'NotFoundError':
          return '요청한 정보를 찾을 수 없습니다.';
        case 'NetworkError':
          return '네트워크 연결에 문제가 발생했습니다.';
        case 'ApiError':
          return '서버와의 통신 중 문제가 발생했습니다.';
        case 'ExternalServiceError':
          return '외부 서비스 연결에 문제가 발생했습니다.';
        default:
          return errorMessage;
      }
    }

    // 일반 에러 메시지 처리
    const lowerMessage = errorMessage.toLowerCase();
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return '네트워크 연결을 확인해 주세요.';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return '입력한 정보를 다시 확인해 주세요.';
    }
    if (lowerMessage.includes('auth')) {
      return '로그인 상태를 확인해 주세요.';
    }

    return '예상치 못한 문제가 발생했습니다.';
  };

  const handleReport = async () => {
    if (!onReport) return;
    
    setIsReporting(true);
    try {
      await Promise.resolve(onReport(error));
    } catch (reportError) {
      console.error('Error reporting failed:', reportError);
    } finally {
      setIsReporting(false);
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const refreshPage = () => {
    window.location.reload();
  };

  return (
    <div className={`min-h-[300px] flex items-center justify-center p-6 ${styles.containerClass} border rounded-lg`}>
      <div className="text-center max-w-2xl space-y-6">
        {/* 아이콘 */}
        <div className="flex justify-center">
          <AlertTriangle className={`w-16 h-16 ${styles.iconClass}`} />
        </div>

        {/* 제목 */}
        <div>
          <h1 className={`text-2xl font-bold ${styles.titleClass} mb-2`}>
            문제가 발생했습니다
          </h1>
          <p className={`text-lg ${styles.messageClass}`}>
            {getUserFriendlyMessage()}
          </p>
        </div>

        {/* 에러 상세 정보 (선택적) */}
        {showDetails && (
          <div className="text-left bg-white p-4 rounded border">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm text-gray-700">에러 타입:</span>
                <span className="text-sm text-gray-600">{errorType}</span>
              </div>
              {isCustomError && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-gray-700">상태 코드:</span>
                    <span className="text-sm text-gray-600">{(error as any).statusCode}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-gray-700">작업 가능:</span>
                    <span className="text-sm text-gray-600">
                      {(error as any).isOperational ? '예' : '아니오'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-gray-700">발생 시각:</span>
                    <span className="text-sm text-gray-600">
                      {new Date((error as any).timestamp).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 기술적 세부사항 (토글) */}
        <div className="space-y-2">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="text-sm text-gray-600 hover:text-gray-800 underline flex items-center gap-1 mx-auto"
          >
            <Bug className="w-4 h-4" />
            기술적 세부사항 {showTechnicalDetails ? '숨기기' : '보기'}
          </button>
          
          {showTechnicalDetails && (
            <details className="text-left bg-gray-50 p-4 rounded border text-sm">
              <summary className="cursor-pointer font-semibold mb-2">에러 메시지</summary>
              <pre className="whitespace-pre-wrap text-xs text-gray-700 mt-2 p-2 bg-white rounded border overflow-auto max-h-32">
                {errorMessage}
              </pre>
              {error.stack && (
                <>
                  <summary className="cursor-pointer font-semibold mt-4 mb-2">스택 트레이스</summary>
                  <pre className="whitespace-pre-wrap text-xs text-gray-700 mt-2 p-2 bg-white rounded border overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </>
              )}
              {isCustomError && (error as any).context && (
                <>
                  <summary className="cursor-pointer font-semibold mt-4 mb-2">컨텍스트</summary>
                  <pre className="whitespace-pre-wrap text-xs text-gray-700 mt-2 p-2 bg-white rounded border overflow-auto max-h-32">
                    {JSON.stringify((error as any).context, null, 2)}
                  </pre>
                </>
              )}
            </details>
          )}
        </div>

        {/* 액션 버튼들 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            onClick={resetErrorBoundary}
            className="flex items-center gap-2"
            variant="default"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </Button>
          
          <Button
            onClick={refreshPage}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            페이지 새로고침
          </Button>
          
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            홈으로 이동
          </Button>
          
          {onReport && (
            <Button
              onClick={handleReport}
              disabled={isReporting}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Bug className="w-4 h-4" />
              {isReporting ? '신고 중...' : '문제 신고'}
            </Button>
          )}
        </div>

        {/* 추가 도움말 */}
        <div className="text-sm text-gray-500 mt-6">
          <p>문제가 계속 발생하면 브라우저를 새로고침하거나 관리자에게 문의해 주세요.</p>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback; 