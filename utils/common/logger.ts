/**
 * 중앙화된 로깅 서비스
 * 에러 로깅, 이벤트 트래킹, 디버깅 정보를 관리합니다.
 */

import { AppError, isAppError, getErrorType } from './errors';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error | AppError;
  stack?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  component?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsoleLogging: boolean;
  enableLocalStorage: boolean;
  maxLocalEntries: number;
  enableRemoteLogging: boolean;
  remoteEndpoint?: string;
  sessionId?: string;
  userId?: string;
}

class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private sessionId: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsoleLogging: true,
      enableLocalStorage: false,
      maxLocalEntries: 1000,
      enableRemoteLogging: false,
      ...config
    };

    this.sessionId = this.config.sessionId || this.generateSessionId();
    this.initializeLogger();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeLogger(): void {
    // 기존 로그 복원 (localStorage에서)
    if (this.config.enableLocalStorage && typeof window !== 'undefined') {
      this.loadLogsFromStorage();
    }

    // 전역 에러 핸들러 등록
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.error('Uncaught Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled Promise Rejection', {
          reason: event.reason,
          promise: event.promise
        });
      });
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error | AppError
  ): LogEntry {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      context,
      error,
      stack: error?.stack,
      userId: this.config.userId,
      sessionId: this.sessionId,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      component: context?.component
    };

    return entry;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const errorInfo = entry.error ? ` [${getErrorType(entry.error)}]` : '';
    const component = entry.component ? ` [${entry.component}]` : '';
    
    return `[${timestamp}] ${levelName}${component}${errorInfo}: ${entry.message}`;
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.config.enableConsoleLogging) return;

    const formattedMessage = this.formatLogEntry(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, entry.context);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, entry.context);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, entry.context);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formattedMessage, entry.context);
        if (entry.stack) {
          console.error('Stack trace:', entry.stack);
        }
        break;
    }
  }

  private saveToLocalStorage(): void {
    if (!this.config.enableLocalStorage || typeof window === 'undefined') return;

    try {
      // 최대 개수 제한
      const logsToSave = this.logs.slice(-this.config.maxLocalEntries);
      localStorage.setItem('app-logs', JSON.stringify(logsToSave));
    } catch (error) {
      console.warn('Failed to save logs to localStorage:', error);
    }
  }

  private loadLogsFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const savedLogs = localStorage.getItem('app-logs');
      if (savedLogs) {
        const logs = JSON.parse(savedLogs);
        this.logs = logs.map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load logs from localStorage:', error);
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.enableRemoteLogging || !this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...entry,
          timestamp: entry.timestamp.toISOString()
        })
      });
    } catch (error) {
      console.warn('Failed to send log to remote endpoint:', error);
    }
  }

  private addLog(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error | AppError
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error);
    
    // 로그 저장
    this.logs.push(entry);

    // 콘솔 출력
    this.writeToConsole(entry);

    // 로컬 스토리지 저장
    this.saveToLocalStorage();

    // 원격 전송
    this.sendToRemote(entry);
  }

  // 공개 메서드들
  debug(message: string, context?: Record<string, any>): void {
    this.addLog(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.addLog(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.addLog(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, any>, error?: Error | AppError): void {
    this.addLog(LogLevel.ERROR, message, context, error);
  }

  critical(message: string, context?: Record<string, any>, error?: Error | AppError): void {
    this.addLog(LogLevel.CRITICAL, message, context, error);
  }

  // 에러 객체를 직접 로깅
  logError(error: Error | AppError, context?: Record<string, any>): void {
    const message = error.message || '알 수 없는 에러';
    const errorContext = {
      ...context,
      errorType: getErrorType(error),
      isOperational: isAppError(error) ? error.isOperational : undefined,
      statusCode: isAppError(error) ? error.statusCode : undefined
    };

    if (isAppError(error) && error.statusCode >= 500) {
      this.critical(message, errorContext, error);
    } else {
      this.error(message, errorContext, error);
    }
  }

  // 이벤트 트래킹
  trackEvent(eventName: string, properties?: Record<string, any>): void {
    this.info(`Event: ${eventName}`, {
      eventType: 'user_action',
      eventName,
      properties
    });
  }

  // 성능 추적
  trackPerformance(operation: string, duration: number, context?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      eventType: 'performance',
      operation,
      duration,
      ...context
    });
  }

  // 설정 업데이트
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // 로그 조회
  getLogs(level?: LogLevel, limit?: number): LogEntry[] {
    let filteredLogs = level !== undefined 
      ? this.logs.filter(log => log.level >= level)
      : this.logs;

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  // 로그 클리어
  clearLogs(): void {
    this.logs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('app-logs');
    }
  }

  // 로그 내보내기 (JSON)
  exportLogs(): string {
    return JSON.stringify(this.logs.map(log => ({
      ...log,
      timestamp: log.timestamp.toISOString()
    })), null, 2);
  }

  // 세션 ID 조회
  getSessionId(): string {
    return this.sessionId;
  }

  // 통계 정보
  getStats(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    sessionId: string;
    oldestLog?: Date;
    newestLog?: Date;
  } {
    const logsByLevel: Record<string, number> = {};
    
    for (const level of Object.values(LogLevel)) {
      if (typeof level === 'number') {
        logsByLevel[LogLevel[level]] = this.logs.filter(log => log.level === level).length;
      }
    }

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      sessionId: this.sessionId,
      oldestLog: this.logs[0]?.timestamp,
      newestLog: this.logs[this.logs.length - 1]?.timestamp
    };
  }
}

// 기본 로거 인스턴스 생성
export const logger = new Logger({
  level: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  enableConsoleLogging: true,
  enableLocalStorage: process.env.NODE_ENV === 'development',
  enableRemoteLogging: false, // 추후 설정
});

// 편의 함수들
export const logDebug = (message: string, context?: Record<string, any>) => 
  logger.debug(message, context);

export const logInfo = (message: string, context?: Record<string, any>) => 
  logger.info(message, context);

export const logWarn = (message: string, context?: Record<string, any>) => 
  logger.warn(message, context);

export const logError = (message: string, context?: Record<string, any>, error?: Error | AppError) => 
  logger.error(message, context, error);

export const logCritical = (message: string, context?: Record<string, any>, error?: Error | AppError) => 
  logger.critical(message, context, error);

export const trackEvent = (eventName: string, properties?: Record<string, any>) => 
  logger.trackEvent(eventName, properties);

export const trackPerformance = (operation: string, duration: number, context?: Record<string, any>) => 
  logger.trackPerformance(operation, duration, context);

export default logger; 