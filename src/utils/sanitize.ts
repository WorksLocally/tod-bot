/**
 * Utility helpers for sanitising user-provided text prior to storage or display.
 *
 * @module src/utils/sanitize
 */

interface SanitizeOptions {
  maxLength?: number;
}

/**
 * Removes control characters (excluding line feeds), normalises newlines, trims, and limits length.
 *
 * @param input - Raw user input.
 * @param options - Optional configuration.
 * @returns Sanitised string.
 */
export const sanitizeText = (input: string, options: SanitizeOptions = {}): string => {
  const { maxLength } = options;
  if (typeof input !== 'string') {
    return '';
  }

  const normalised = input.replace(/\r\n?/g, '\n');
  // eslint-disable-next-line no-control-regex -- Intentionally removing control characters
  const withoutControl = normalised.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  let trimmed = withoutControl.trim();

  if (typeof maxLength === 'number' && maxLength > 0) {
    trimmed = trimmed.slice(0, maxLength);
  }

  return trimmed;
};
