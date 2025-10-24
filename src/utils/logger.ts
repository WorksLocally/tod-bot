/**
 * Centralised Winston logger configured with console and rotating file transports.
 *
 * @module src/utils/logger
 */

import path from 'path';
import fs from 'fs';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

interface ErrorWithCode extends Error {
  code?: string;
}

const sanitizeMeta = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Error) {
    const error = value as ErrorWithCode;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.code ? { code: error.code } : {}),
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
        sanitized && Object.keys(sanitized as Record<string, unknown>).length ? ` ${JSON.stringify(sanitized)}` : '';
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

export default logger;
