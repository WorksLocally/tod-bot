/**
 * Data access layer for truth and dare questions, including rotation management.
 *
 * @module src/services/questionService
 */

import db from '../database/client.js';
import { generateQuestionId } from '../utils/id.js';
import { sanitizeText } from '../utils/sanitize.js';
import { LRUCache } from '../utils/lruCache.js';
import logger from '../utils/logger.js';

const VALID_QUESTION_TYPES = new Set(['truth', 'dare']);

export type QuestionType = 'truth' | 'dare';

// LRU Cache for frequently accessed questions (capacity: 100 questions)
const questionCache = new LRUCache<string, StoredQuestion>(100);

// Cache for recently fetched questions to reduce DB queries (capacity: 50)
const nextQuestionCache = new LRUCache<QuestionType, QuestionForRotation>(50);

/**
 * Normalises and validates a provided question type value.
 *
 * This function ensures type safety by validating and normalising user input
 * to prevent injection of invalid question types into the database.
 *
 * @param type - Raw question type input from user or API.
 * @returns Normalised question type ('truth' or 'dare').
 * @throws {Error} If the type is not a string.
 * @throws {Error} If the type is not 'truth' or 'dare' (case-insensitive).
 *
 * @example
 * ```typescript
 * normalizeType('TRUTH'); // returns 'truth'
 * normalizeType('dare');  // returns 'dare'
 * normalizeType('invalid'); // throws Error
 * ```
 */
const normalizeType = (type: string): QuestionType => {
  if (typeof type !== 'string') {
    throw new Error('Question type must be a string.');
  }
  const normalized = type.toLowerCase();
  if (!VALID_QUESTION_TYPES.has(normalized)) {
    throw new Error(`Unsupported question type: ${type}`);
  }
  return normalized as QuestionType;
};

export interface StoredQuestion {
  question_id: string;
  type: QuestionType;
  text: string;
  position: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface MaxPositionResult {
  maxPosition: number;
}

interface RotationStateResult {
  lastPosition: number;
}

interface QuestionForRotation {
  question_id: string;
  type: QuestionType;
  text: string;
  position: number;
}

// Prepared statements are cached for performance
const STATEMENTS = {
  getMaxPosition: db.prepare(
    'SELECT IFNULL(MAX(position), 0) AS maxPosition FROM questions WHERE type = ?'
  ),
  insertQuestion: db.prepare(
    'INSERT INTO questions (question_id, type, text, created_by, position) VALUES (?, ?, ?, ?, ?)'
  ),
  updateQuestion: db.prepare(
    "UPDATE questions SET text = ?, updated_at = datetime('now') WHERE question_id = ? RETURNING question_id, type, text, position, created_at, updated_at, created_by"
  ),
  deleteQuestion: db.prepare('DELETE FROM questions WHERE question_id = ?'),
  getQuestionById: db.prepare(
    'SELECT question_id, type, text, position, created_at, updated_at, created_by FROM questions WHERE question_id = ?'
  ),
  listQuestions: db.prepare(
    'SELECT question_id, type, text, position, created_at, updated_at, created_by FROM questions ORDER BY type, position ASC'
  ),
  listQuestionsByType: db.prepare(
    'SELECT question_id, type, text, position, created_at, updated_at, created_by FROM questions WHERE type = ? ORDER BY position ASC'
  ),
  getRotationState: db.prepare(
    'SELECT last_position AS lastPosition FROM rotation_state WHERE type = ?'
  ),
  upsertRotationState: db.prepare(
    'INSERT INTO rotation_state (type, last_position) VALUES (?, ?) ON CONFLICT(type) DO UPDATE SET last_position = excluded.last_position'
  ),
  getNextQuestion: db.prepare(
    'SELECT question_id, type, text, position FROM questions WHERE type = ? AND position > ? ORDER BY position ASC LIMIT 1'
  ),
  getFirstQuestion: db.prepare(
    'SELECT question_id, type, text, position FROM questions WHERE type = ? ORDER BY position ASC LIMIT 1'
  ),
} as const;

interface AddQuestionParams {
  type: string;
  text: string;
  createdBy?: string;
}

/**
 * Inserts a new question at the end of its type list and returns the stored record.
 *
 * This function performs the following operations within a database transaction:
 * 1. Validates and sanitizes the input text (max 4000 characters)
 * 2. Generates a unique 8-character alphanumeric ID
 * 3. Determines the next position in the rotation queue
 * 4. Inserts the question into the database
 * 5. Caches the question for future retrieval
 *
 * Security: All text input is sanitized to remove control characters and prevent
 * injection attacks. Prepared statements are used for database operations.
 *
 * @param params - Question attributes including type, text, and optional creator ID.
 * @param params.type - Question type ('truth' or 'dare', case-insensitive).
 * @param params.text - Question text content (will be sanitized, max 4000 chars).
 * @param params.createdBy - Optional Discord user ID of the creator.
 * @returns Newly inserted question with generated ID and position.
 * @throws {Error} If question text is empty after sanitization.
 * @throws {Error} If question type is invalid.
 * @throws {Error} If database insertion fails.
 *
 * @example
 * ```typescript
 * const question = addQuestion({
 *   type: 'truth',
 *   text: 'What is your biggest fear?',
 *   createdBy: '123456789012345678'
 * });
 * console.log(question.question_id); // '8A3F2D1C'
 * console.log(question.position); // 42
 * ```
 */
export const addQuestion = ({ type, text, createdBy }: AddQuestionParams): StoredQuestion => {
  const questionType = normalizeType(type);
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    logger.error('Attempted to add question with empty text after sanitization', {
      type: questionType,
      createdBy,
      originalLength: text.length
    });
    throw new Error('Question text cannot be empty.');
  }

  const insert = db.transaction(() => {
    const maxPosition = (STATEMENTS.getMaxPosition.get(questionType) as MaxPositionResult).maxPosition;
    const position = maxPosition + 1;

    let questionId: string = '';
    let inserted = false;
    let retryCount = 0;

    while (!inserted) {
      questionId = generateQuestionId();
      try {
        STATEMENTS.insertQuestion.run(
          questionId,
          questionType,
          sanitizedText,
          createdBy || null,
          position
        );
        inserted = true;
      } catch (error) {
        if ((error as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE') {
          logger.error('Failed to insert question due to database error', {
            error,
            type: questionType,
            position,
            createdBy
          });
          throw error;
        }
        retryCount++;
        if (retryCount > 10) {
          logger.error('Failed to generate unique question ID after multiple attempts', {
            type: questionType,
            retryCount
          });
          throw new Error('Failed to generate unique question ID');
        }
      }
    }

    const result = STATEMENTS.getQuestionById.get(questionId) as StoredQuestion;

    // Cache the newly added question
    questionCache.set(questionId, result);

    // Invalidate next question cache for this type since we added a new one
    nextQuestionCache.delete(questionType);

    logger.info('Successfully added new question', {
      questionId,
      type: questionType,
      position: result.position,
      createdBy,
      textLength: sanitizedText.length
    });

    return result;
  });

  return insert();
};

interface EditQuestionParams {
  questionId: string;
  text: string;
}

/**
 * Updates the text of a stored question.
 *
 * The question text is sanitized before updating, and the cache is invalidated
 * to ensure subsequent reads retrieve the updated version.
 *
 * Security: Input is sanitized to prevent injection attacks.
 *
 * @param params - Update payload containing question ID and new text.
 * @param params.questionId - 8-character question identifier.
 * @param params.text - New question text (will be sanitized, max 4000 chars).
 * @returns The updated question record if found and updated, null otherwise.
 * @throws {Error} If question text is empty after sanitization.
 *
 * @example
 * ```typescript
 * const updated = editQuestion({
 *   questionId: '8A3F2D1C',
 *   text: 'What is your greatest accomplishment?'
 * });
 * if (updated) {
 *   console.log('Updated:', updated.text);
 * }
 * ```
 */
export const editQuestion = ({ questionId, text }: EditQuestionParams): StoredQuestion | null => {
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    logger.error('Attempted to edit question with empty text after sanitization', {
      questionId,
      originalLength: text.length
    });
    throw new Error('Question text cannot be empty.');
  }

  try {
    // Note: Using `.get()` for UPDATE ... RETURNING is intentional.
    // SQLite's RETURNING clause allows UPDATE to return the updated row as an object,
    // or `undefined` if no row matched. This is non-obvious, so we document it here.
    const updated = STATEMENTS.updateQuestion.get(sanitizedText, questionId) as StoredQuestion | undefined;

    if (updated) {
      // Invalidate cache for this question
      questionCache.delete(questionId);

      logger.info('Successfully edited question', {
        questionId,
        textLength: sanitizedText.length
      });
      return updated;
    } else {
      logger.warn('Attempted to edit non-existent question', {
        questionId
      });
      return null;
    }
  } catch (error) {
    logger.error('Failed to edit question', { error, questionId });
    throw error;
  }
};

/**
 * Removes a question from the database.
 *
 * @param questionId - Identifier of the question to delete.
 * @returns Count of rows removed.
 */
export const deleteQuestion = (questionId: string): number => {
  try {
    const info = STATEMENTS.deleteQuestion.run(questionId);

    // Remove from cache
    questionCache.delete(questionId);

    if (info.changes > 0) {
      logger.info('Successfully deleted question', {
        questionId
      });
    } else {
      logger.warn('Attempted to delete non-existent question', {
        questionId
      });
    }

    return info.changes;
  } catch (error) {
    logger.error('Failed to delete question', { error, questionId });
    throw error;
  }
};

/**
 * Retrieves a question by its identifier.
 *
 * @param questionId - Identifier to query.
 * @returns Matching question, if present.
 */
export const getQuestionById = (questionId: string): StoredQuestion | undefined => {
  // Check cache first
  const cached = questionCache.get(questionId);
  if (cached) {
    logger.debug('Question cache hit', { questionId });
    return cached;
  }

  // Fetch from database and cache
  const question = STATEMENTS.getQuestionById.get(questionId) as StoredQuestion | undefined;
  if (question) {
    questionCache.set(questionId, question);
    logger.debug('Question fetched from database and cached', { questionId, type: question.type });
  } else {
    logger.debug('Question not found', { questionId });
  }

  return question;
};

/**
 * Lists questions optionally filtered by type.
 *
 * @param type - Optional filter for question type.
 * @returns List of stored questions.
 */
export const listQuestions = (type?: QuestionType): StoredQuestion[] => {
  try {
    let questions: StoredQuestion[];
    if (type) {
      const normalized = normalizeType(type);
      questions = STATEMENTS.listQuestionsByType.all(normalized) as StoredQuestion[];
      logger.debug('Listed questions by type', { type: normalized, count: questions.length });
    } else {
      questions = STATEMENTS.listQuestions.all() as StoredQuestion[];
      logger.debug('Listed all questions', { count: questions.length });
    }
    return questions;
  } catch (error) {
    logger.error('Failed to list questions', { error, type });
    throw error;
  }
};

/**
 * Retrieves the next question in rotation for the provided type, wrapping around when necessary.
 *
 * This function implements a simple round-robin rotation system:
 * 1. Fetches the last served position from rotation_state table
 * 2. Queries for the next question with position > last_position
 * 3. If no question found, wraps around to the first question
 * 4. Updates rotation_state with the new position
 *
 * All operations are performed within a transaction to ensure consistency
 * when multiple requests are processed concurrently.
 *
 * @param type - Question type to fetch ('truth' or 'dare').
 * @returns The next question with ID, text, type, and position, or null if no questions exist.
 *
 * @example
 * ```typescript
 * const question = getNextQuestion('truth');
 * if (question) {
 *   console.log(question.text); // "What is your biggest secret?"
 *   console.log(question.question_id); // "8A3F2D1C"
 * }
 * ```
 */
export const getNextQuestion = (type: QuestionType): QuestionForRotation | null => {
  const normalizedType = normalizeType(type);

  try {
    const fetch = db.transaction(() => {
      const state = STATEMENTS.getRotationState.get(normalizedType) as RotationStateResult | undefined;
      const lastPosition = state ? state.lastPosition : 0;
      let nextQuestion = STATEMENTS.getNextQuestion.get(normalizedType, lastPosition) as QuestionForRotation | undefined;

      let wrapped = false;
      if (!nextQuestion) {
        // Wrap around to the beginning
        nextQuestion = STATEMENTS.getFirstQuestion.get(normalizedType) as QuestionForRotation | undefined;
        wrapped = true;

        if (!nextQuestion) {
          logger.warn('No questions available for rotation', { type: normalizedType });
          return null;
        }
      }

      STATEMENTS.upsertRotationState.run(normalizedType, nextQuestion.position);

      logger.info('Retrieved next question from rotation', {
        questionId: nextQuestion.question_id,
        type: normalizedType,
        position: nextQuestion.position,
        lastPosition,
        wrapped
      });

      return nextQuestion;
    });

    return fetch();
  } catch (error) {
    logger.error('Failed to get next question from rotation', { error, type: normalizedType });
    throw error;
  }
};
