export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  debug(message: string, data?: any) {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }

  info(message: string, data?: any) {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', message, data);
    }
  }

  warn(message: string, data?: any) {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', message, data);
    }
  }

  error(message: string, data?: any) {
    if (this.level <= LogLevel.ERROR) {
      this.log('ERROR', message, data);
    }
  }

  private log(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      console.error(logMessage, data);
    } else {
      console.error(logMessage);
    }
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }
}