/**
 * Data access layer for truth and dare questions, including rotation management.
 *
 * @module src/services/questionService
 */

const db = require('../database/client');
const { generateQuestionId } = require('../utils/id');
const { sanitizeText } = require('../utils/sanitize');

const VALID_QUESTION_TYPES = new Set(['truth', 'dare']);

/**
 * Normalises and validates a provided question type value.
 *
 * @param {string} type - Raw question type input.
 * @returns {'truth' | 'dare'} - Normalised question type.
 * @throws {Error} If the type value is unsupported.
 */
const normalizeType = (type) => {
  if (typeof type !== 'string') {
    throw new Error('Question type must be a string.');
  }
  const normalized = type.toLowerCase();
  if (!VALID_QUESTION_TYPES.has(normalized)) {
    throw new Error(`Unsupported question type: ${type}`);
  }
  return /** @type {'truth' | 'dare'} */ (normalized);
};

/**
 * @typedef {Object} StoredQuestion
 * @property {string} question_id - Unique question identifier.
 * @property {'truth' | 'dare'} type - Question category.
 * @property {string} text - Question content.
 * @property {number} position - Position within sequential ordering.
 * @property {string} created_at - ISO timestamp when the question was added.
 * @property {string} updated_at - ISO timestamp when the question was last updated.
 * @property {string | null} created_by - Discord user ID of the creator, if available.
 */

const getMaxPositionStmt = db.prepare(
  'SELECT IFNULL(MAX(position), 0) AS maxPosition FROM questions WHERE type = ?'
);
const insertQuestionStmt = db.prepare(
  'INSERT INTO questions (question_id, type, text, created_by, position) VALUES (?, ?, ?, ?, ?)'
);
const updateQuestionStmt = db.prepare(
  "UPDATE questions SET text = ?, updated_at = datetime('now') WHERE question_id = ?"
);
const deleteQuestionStmt = db.prepare('DELETE FROM questions WHERE question_id = ?');
const getQuestionByIdStmt = db.prepare(
  'SELECT question_id, type, text, position, created_at, updated_at, created_by FROM questions WHERE question_id = ?'
);
const listQuestionsStmt = db.prepare(
  'SELECT question_id, type, text, position, created_at, updated_at, created_by FROM questions ORDER BY type, position ASC'
);
const listQuestionsByTypeStmt = db.prepare(
  'SELECT question_id, type, text, position, created_at, updated_at, created_by FROM questions WHERE type = ? ORDER BY position ASC'
);

const getRotationStateStmt = db.prepare(
  'SELECT last_position AS lastPosition FROM rotation_state WHERE type = ?'
);
const upsertRotationStateStmt = db.prepare(
  'INSERT INTO rotation_state (type, last_position) VALUES (?, ?) ON CONFLICT(type) DO UPDATE SET last_position = excluded.last_position'
);
const getNextQuestionStmt = db.prepare(
  'SELECT question_id, type, text, position FROM questions WHERE type = ? AND position > ? ORDER BY position ASC LIMIT 1'
);
const getFirstQuestionStmt = db.prepare(
  'SELECT question_id, type, text, position FROM questions WHERE type = ? ORDER BY position ASC LIMIT 1'
);

/**
 * Inserts a new question at the end of its type list and returns the stored record.
 *
 * @param {{ type: string, text: string, createdBy?: string }} params - Question attributes.
 * @returns {StoredQuestion} - Newly inserted question.
 */
const addQuestion = ({ type, text, createdBy }) => {
  const questionType = normalizeType(type);
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    throw new Error('Question text cannot be empty.');
  }

  const insert = db.transaction(() => {
    const maxPosition = getMaxPositionStmt.get(questionType).maxPosition;
    const position = maxPosition + 1;

    let questionId;
    let inserted = false;

    while (!inserted) {
      questionId = generateQuestionId();
      try {
        insertQuestionStmt.run(
          questionId,
          questionType,
          sanitizedText,
          createdBy || null,
          position
        );
        inserted = true;
      } catch (error) {
        if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
          throw error;
        }
      }
    }

    return getQuestionByIdStmt.get(questionId);
  });

  return insert();
};

/**
 * Updates the text of a stored question.
 *
 * @param {{ questionId: string, text: string }} params - Update payload.
 * @returns {number} - Count of rows affected.
 */
const editQuestion = ({ questionId, text }) => {
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    throw new Error('Question text cannot be empty.');
  }

  const info = updateQuestionStmt.run(sanitizedText, questionId);
  return info.changes;
};

/**
 * Removes a question from the database.
 *
 * @param {string} questionId - Identifier of the question to delete.
 * @returns {number} - Count of rows removed.
 */
const deleteQuestion = (questionId) => {
  const info = deleteQuestionStmt.run(questionId);
  return info.changes;
};

/**
 * Retrieves a question by its identifier.
 *
 * @param {string} questionId - Identifier to query.
 * @returns {StoredQuestion | undefined} - Matching question, if present.
 */
const getQuestionById = (questionId) => getQuestionByIdStmt.get(questionId);

/**
 * Lists questions optionally filtered by type.
 *
 * @param {'truth' | 'dare'} [type] - Optional filter for question type.
 * @returns {StoredQuestion[]} - List of stored questions.
 */
const listQuestions = (type) => {
  if (type) {
    const normalized = normalizeType(type);
    return listQuestionsByTypeStmt.all(normalized);
  }
  return listQuestionsStmt.all();
};

/**
 * Retrieves the next question in rotation for the provided type, wrapping around when necessary.
 *
 * @param {'truth' | 'dare'} type - Question type to fetch.
 * @returns {{ question_id: string, type: 'truth' | 'dare', text: string, position: number } | null} -
 *   The next question or null if none exist.
 */
const getNextQuestion = (type) => {
  const normalizedType = normalizeType(type);
  const fetch = db.transaction(() => {
    const state = getRotationStateStmt.get(normalizedType);
    const lastPosition = state ? state.lastPosition : 0;
    let nextQuestion = getNextQuestionStmt.get(normalizedType, lastPosition);

    if (!nextQuestion) {
      nextQuestion = getFirstQuestionStmt.get(normalizedType);
      if (!nextQuestion) {
        return null;
      }
    }

    upsertRotationStateStmt.run(normalizedType, nextQuestion.position);
    return nextQuestion;
  });

  return fetch();
};

module.exports = {
  addQuestion,
  editQuestion,
  deleteQuestion,
  listQuestions,
  getQuestionById,
  getNextQuestion,
};
