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
  // Fast path for primitives
  if (value === null || value === undefined) {
    return value;
  }

  const valueType = typeof value;
  if (valueType !== 'object') {
    return value;
  }

  // Handle Error objects
  if (value instanceof Error) {
    const error = value as ErrorWithCode;
    const result: Record<string, string | undefined> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    if (error.code) {
      result.code = error.code;
    }
    return result;
  }

  // Circular reference check
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMeta(item, seen));
  }

  // Handle plain objects - optimize by avoiding Object.fromEntries overhead
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = sanitizeMeta(item, seen);
  }
  return result;
};

const logsDir = path.join(process.cwd(), 'logs');
console.log(`[DEBUG] Logs directory: ${logsDir}`); // Debug log
if (!fs.existsSync(logsDir)) {
  console.log(`[DEBUG] Creating logs directory: ${logsDir}`); // Debug log
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.errors({ stack: true }),
    format.timestamp(),
    format.printf((info) => {
      const { timestamp, level, message, stack, ...rest } = info;

      // Fast path: skip sanitization and stringification if no metadata
      const hasMetadata = Object.keys(rest).length > 0;
      let restString = '';

      if (hasMetadata) {
        const sanitized = sanitizeMeta(rest);
        // Only stringify if we have actual metadata after sanitization
        if (sanitized && Object.keys(sanitized as Record<string, unknown>).length > 0) {
          restString = ` ${JSON.stringify(sanitized)}`;
        }
      }

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
