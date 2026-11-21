/**
 * Aetheria Agent - Logger & Event Bus
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

class Logger {
  constructor(prefix = 'Aetheria') {
    this.prefix = prefix;
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  _notifyListeners(level, message, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    this.listeners.forEach(cb => cb({ level, timestamp, prefix: this.prefix, message, args }));
  }

  format(level, message, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    return [`[${timestamp}] [${this.prefix}] [${level.toUpperCase()}]:`, message, ...args];
  }

  debug(message, ...args) {
    console.debug(...this.format(LogLevel.DEBUG, message, ...args));
    this._notifyListeners(LogLevel.DEBUG, message, ...args);
  }

  info(message, ...args) {
    console.log(...this.format(LogLevel.INFO, message, ...args));
    this._notifyListeners(LogLevel.INFO, message, ...args);
  }

  warn(message, ...args) {
    console.warn(...this.format(LogLevel.WARN, message, ...args));
    this._notifyListeners(LogLevel.WARN, message, ...args);
  }

  error(message, ...args) {
    console.error(...this.format(LogLevel.ERROR, message, ...args));
    this._notifyListeners(LogLevel.ERROR, message, ...args);
  }
}

export const logger = new Logger('AgentCore');
