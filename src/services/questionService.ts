/**
 * Data access layer for truth and dare questions, including rotation management.
 *
 * @module src/services/questionService
 */

import db from '../database/client.js';
import { generateQuestionId } from '../utils/id.js';
import { sanitizeText } from '../utils/sanitize.js';
import { LRUCache } from '../utils/lruCache.js';

const VALID_QUESTION_TYPES = new Set(['truth', 'dare']);

export type QuestionType = 'truth' | 'dare';

// LRU Cache for frequently accessed questions (capacity: 100 questions)
const questionCache = new LRUCache<string, StoredQuestion>(100);

// Cache for recently fetched questions to reduce DB queries (capacity: 50)
const nextQuestionCache = new LRUCache<QuestionType, QuestionForRotation>(50);

/**
 * Normalises and validates a provided question type value.
 *
 * @param type - Raw question type input.
 * @returns Normalised question type.
 * @throws If the type value is unsupported.
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
    "UPDATE questions SET text = ?, updated_at = datetime('now') WHERE question_id = ?"
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
 * @param params - Question attributes.
 * @returns Newly inserted question.
 */
export const addQuestion = ({ type, text, createdBy }: AddQuestionParams): StoredQuestion => {
  const questionType = normalizeType(type);
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    throw new Error('Question text cannot be empty.');
  }

  const insert = db.transaction(() => {
    const maxPosition = (STATEMENTS.getMaxPosition.get(questionType) as MaxPositionResult).maxPosition;
    const position = maxPosition + 1;

    let questionId: string = '';
    let inserted = false;

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
          throw error;
        }
      }
    }

    const result = STATEMENTS.getQuestionById.get(questionId) as StoredQuestion;
    
    // Cache the newly added question
    questionCache.set(questionId, result);
    
    // Invalidate next question cache for this type since we added a new one
    nextQuestionCache.delete(questionType);
    
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
 * @param params - Update payload.
 * @returns Count of rows affected.
 */
export const editQuestion = ({ questionId, text }: EditQuestionParams): number => {
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    throw new Error('Question text cannot be empty.');
  }

  const info = STATEMENTS.updateQuestion.run(sanitizedText, questionId);
  
  // Invalidate cache for this question
  questionCache.delete(questionId);
  
  return info.changes;
};

/**
 * Removes a question from the database.
 *
 * @param questionId - Identifier of the question to delete.
 * @returns Count of rows removed.
 */
export const deleteQuestion = (questionId: string): number => {
  const info = STATEMENTS.deleteQuestion.run(questionId);
  
  // Remove from cache
  questionCache.delete(questionId);
  
  return info.changes;
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
    return cached;
  }
  
  // Fetch from database and cache
  const question = STATEMENTS.getQuestionById.get(questionId) as StoredQuestion | undefined;
  if (question) {
    questionCache.set(questionId, question);
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
  if (type) {
    const normalized = normalizeType(type);
    return STATEMENTS.listQuestionsByType.all(normalized) as StoredQuestion[];
  }
  return STATEMENTS.listQuestions.all() as StoredQuestion[];
};

/**
 * Retrieves the next question in rotation for the provided type, wrapping around when necessary.
 *
 * @param type - Question type to fetch.
 * @returns The next question or null if none exist.
 */
export const getNextQuestion = (type: QuestionType): QuestionForRotation | null => {
  const normalizedType = normalizeType(type);
  const fetch = db.transaction(() => {
    const state = STATEMENTS.getRotationState.get(normalizedType) as RotationStateResult | undefined;
    const lastPosition = state ? state.lastPosition : 0;
    let nextQuestion = STATEMENTS.getNextQuestion.get(normalizedType, lastPosition) as QuestionForRotation | undefined;

    if (!nextQuestion) {
      nextQuestion = STATEMENTS.getFirstQuestion.get(normalizedType) as QuestionForRotation | undefined;
      if (!nextQuestion) {
        return null;
      }
    }

    STATEMENTS.upsertRotationState.run(normalizedType, nextQuestion.position);
    return nextQuestion;
  });

  return fetch();
};
