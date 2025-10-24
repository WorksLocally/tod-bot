/**
 * Utility helpers for sanitising user-provided text prior to storage or display.
 *
 * @module src/utils/sanitize
 */

/**
 * Removes control characters (excluding line feeds), normalises newlines, trims, and limits length.
 *
 * @param {string} input - Raw user input.
 * @param {{ maxLength?: number }} [options] - Optional configuration.
 * @returns {string} - Sanitised string.
 */
const sanitizeText = (input, options = {}) => {
  const { maxLength } = options;
  if (typeof input !== 'string') {
    return '';
  }

  const normalised = input.replace(/\r\n?/g, '\n');
  const withoutControl = normalised.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  let trimmed = withoutControl.trim();

  if (typeof maxLength === 'number' && maxLength > 0) {
    trimmed = trimmed.slice(0, maxLength);
  }

  return trimmed;
};

module.exports = {
  sanitizeText,
};
