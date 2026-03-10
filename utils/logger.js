class Logger {
  log(level, context, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data
    };
    console.log(JSON.stringify(logEntry));
  }

  info(context, message, data) {
    this.log('INFO', context, message, data);
  }

  warn(context, message, data) {
    this.log('WARN', context, message, data);
  }

  error(context, message, data) {
    this.log('ERROR', context, message, data);
  }
}

module.exports = new Logger();
