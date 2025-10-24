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
 * @param {number} length - Total number of characters to generate.
 * @returns {string} - Randomly generated identifier.
 */
const generateId = (length) => {
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
 * @returns {string} - Eight-character question identifier.
 */
const generateQuestionId = () => generateId(8);
/**
 * Creates an ID for an approval submission.
 *
 * @returns {string} - Six-character submission identifier.
 */
const generateSubmissionId = () => generateId(6);

module.exports = {
  generateQuestionId,
  generateSubmissionId,
};
