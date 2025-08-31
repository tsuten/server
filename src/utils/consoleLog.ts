/**
 * ログレベルの定義
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

/**
 * ログカテゴリの定義
 */
export enum LogCategory {
  SYSTEM = 'SYSTEM',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  RECEIVER = 'RECEIVER',
  OPERATION = 'OPERATION',
  REPOSITORY = 'REPOSITORY',
  SCHEMA = 'SCHEMA',
  MODEL = 'MODEL',
  SOCKET = 'SOCKET',
  AUTH = 'AUTH',
  ERROR = 'ERROR'
}

/**
 * ログ設定の型定義
 */
export interface LogConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableTimestamp: boolean;
  enableColors: boolean;
  maxDataLength: number;
}

/**
 * グローバル設定
 */
let globalConfig: LogConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableTimestamp: true,
  enableColors: process.env.NODE_ENV !== 'production',
  maxDataLength: 1000
};

/**
 * ログ設定を更新
 */
export function configureLogger(config: Partial<LogConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * データのサニタイズ
 */
function sanitizeData(data: any): any {
  if (!data) return data;
  
  try {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    
    if (typeof data === 'object') {
      const sanitized = { ...data };
      for (const field of sensitiveFields) {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]';
        }
      }
      return sanitized;
    }
    
    return data;
  } catch {
    return '[Sanitization Error]';
  }
}

/**
 * データのフォーマット
 */
function formatData(data: any): string {
  try {
    let formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 0);
    
    if (formatted.length > globalConfig.maxDataLength) {
      formatted = formatted.substring(0, globalConfig.maxDataLength) + '...';
    }
    
    return formatted;
  } catch {
    return '[Non-serializable Object]';
  }
}

/**
 * 色の適用
 */
function applyColors(message: string, color: string): string {
  if (!globalConfig.enableColors) return message;

  const colors: Record<string, string> = {
    gray: '\x1b[90m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m'
  };

  return `${colors[color] || ''}${message}${colors.reset}`;
}

/**
 * ログ出力のメイン関数
 */
function outputLog(level: LogLevel, category: LogCategory, component: string, message: string, data?: any, error?: Error | any): void {
  if (level < globalConfig.minLevel || !globalConfig.enableConsole) return;

  const timestamp = globalConfig.enableTimestamp ? new Date().toISOString().replace('T', ' ').replace('Z', '') : '';
  const levelNames = ['DEBUG', 'INFO ', 'WARN ', 'ERROR', 'FATAL'];
  const levelStr = levelNames[level] || 'UNKNOWN';
  
  let logMessage = '';
  if (timestamp) logMessage += `${timestamp} `;
  logMessage += `${levelStr} [${category}] [${component}] ${message}`;

  if (data !== undefined) {
    logMessage += ` | Data: ${formatData(sanitizeData(data))}`;
  }

  if (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logMessage += ` | Error: ${errorMsg}`;
    if (error instanceof Error && error.stack && level >= LogLevel.ERROR) {
      logMessage += `\nStack: ${error.stack}`;
    }
  }

  const colors = ['gray', 'blue', 'yellow', 'red', 'magenta'];
  const coloredMessage = applyColors(logMessage, colors[level] || 'gray');

  const consoleMethods = [console.debug, console.info, console.warn, console.error, console.error];
  (consoleMethods[level] || console.log)(coloredMessage);
}

/**
 * ログレベル別の関数
 */
export function logDebug(category: LogCategory, component: string, message: string, data?: any): void {
  outputLog(LogLevel.DEBUG, category, component, message, data);
}

export function logInfo(category: LogCategory, component: string, message: string, data?: any): void {
  outputLog(LogLevel.INFO, category, component, message, data);
}

export function logWarn(category: LogCategory, component: string, message: string, data?: any): void {
  outputLog(LogLevel.WARN, category, component, message, data);
}

export function logError(category: LogCategory, component: string, message: string, error?: Error | any, data?: any): void {
  outputLog(LogLevel.ERROR, category, component, message, data, error);
}

export function logFatal(category: LogCategory, component: string, message: string, error?: Error | any, data?: any): void {
  outputLog(LogLevel.FATAL, category, component, message, data, error);
}

/**
 * コンポーネント別ロガーを作成
 */
export function createLogger(category: LogCategory, component: string) {
  return {
    debug: (message: string, data?: any) => logDebug(category, component, message, data),
    info: (message: string, data?: any) => logInfo(category, component, message, data),
    warn: (message: string, data?: any) => logWarn(category, component, message, data),
    error: (message: string, error?: Error | any, data?: any) => logError(category, component, message, error, data),
    fatal: (message: string, error?: Error | any, data?: any) => logFatal(category, component, message, error, data)
  };
}

/**
 * パフォーマンス測定用タイマー
 */
export function startTimer(category: LogCategory, component: string, operation: string): () => void {
  const startTime = Date.now();
  
  return () => {
    const duration = Date.now() - startTime;
    logInfo(category, component, `${operation} completed in ${duration}ms`);
  };
}

// デフォルトロガー（後方互換性のため）
export const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  fatal: logFatal,
  createLogger,
  startTimer
};

export default logger;
