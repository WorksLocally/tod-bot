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
  if (typeof input !== 'string') {
    return '';
  }

  const { maxLength } = options;
  
  // Combine normalization and control character removal in one pass
  const normalised = input.replace(/\r\n?/g, '\n');
  // eslint-disable-next-line no-control-regex -- Intentionally removing control characters
  const withoutControl = normalised.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  
  // Trim before length check to avoid trimming potentially twice
  const trimmed = withoutControl.trim();
  
  // Only slice if we have a valid maxLength and the string exceeds it
  if (typeof maxLength === 'number' && maxLength > 0 && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
};
