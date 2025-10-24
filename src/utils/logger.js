/**
 * Centralised Winston logger configured with console and rotating file transports.
 *
 * @module src/utils/logger
 */

const path = require('path');
const fs = require('fs');

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const sanitizeMeta = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.code ? { code: value.code } : {}),
    };
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMeta(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeMeta(item, seen)])
  );
};

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.errors({ stack: true }),
    format.timestamp(),
    format.printf((info) => {
      const { timestamp, level, message, stack, ...rest } = info;
      const sanitized = sanitizeMeta(rest);
      const restString =
        sanitized && Object.keys(sanitized).length ? ` ${JSON.stringify(sanitized)}` : '';
      const base = `${timestamp} [${level.toUpperCase()}] ${message}${restString}`;
      if (stack && typeof stack === 'string') {
        return `${base}\n${stack}`;
      }
      return base;
    })
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    new DailyRotateFile({
      filename: path.join(logsDir, 'tod-bot-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: process.env.LOG_MAX_FILES || '14d',
      zippedArchive: true,
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

module.exports = logger;
