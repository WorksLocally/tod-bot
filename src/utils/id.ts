/**
 * Helpers for generating deterministic-length alphanumeric identifiers that are
 * easy to copy and share within Discord.
 *
 * @module src/utils/id
 */

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates an uppercase alphanumeric identifier of the provided length.
 *
 * @param length - Total number of characters to generate.
 * @returns Randomly generated identifier.
 */
const generateId = (length: number): string => {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ALPHANUMERIC.length);
    result += ALPHANUMERIC[index];
  }
  return result;
};

/**
 * Creates an ID for a stored question.
 *
 * @returns Eight-character question identifier.
 */
export const generateQuestionId = (): string => generateId(8);

/**
 * Creates an ID for an approval submission.
 *
 * @returns Six-character submission identifier.
 */
export const generateSubmissionId = (): string => generateId(6);
