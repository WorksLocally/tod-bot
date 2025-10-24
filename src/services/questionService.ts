/**
 * Data access layer for truth and dare questions, including rotation management.
 *
 * @module src/services/questionService
 */

import db from '../database/client.js';
import { generateQuestionId } from '../utils/id.js';
import { sanitizeText } from '../utils/sanitize.js';

const VALID_QUESTION_TYPES = new Set(['truth', 'dare']);

export type QuestionType = 'truth' | 'dare';

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
    const maxPosition = (getMaxPositionStmt.get(questionType) as MaxPositionResult).maxPosition;
    const position = maxPosition + 1;

    let questionId: string = '';
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
        if ((error as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE') {
          throw error;
        }
      }
    }

    return getQuestionByIdStmt.get(questionId) as StoredQuestion;
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

  const info = updateQuestionStmt.run(sanitizedText, questionId);
  return info.changes;
};

/**
 * Removes a question from the database.
 *
 * @param questionId - Identifier of the question to delete.
 * @returns Count of rows removed.
 */
export const deleteQuestion = (questionId: string): number => {
  const info = deleteQuestionStmt.run(questionId);
  return info.changes;
};

/**
 * Retrieves a question by its identifier.
 *
 * @param questionId - Identifier to query.
 * @returns Matching question, if present.
 */
export const getQuestionById = (questionId: string): StoredQuestion | undefined => {
  return getQuestionByIdStmt.get(questionId) as StoredQuestion | undefined;
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
    return listQuestionsByTypeStmt.all(normalized) as StoredQuestion[];
  }
  return listQuestionsStmt.all() as StoredQuestion[];
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
    const state = getRotationStateStmt.get(normalizedType) as RotationStateResult | undefined;
    const lastPosition = state ? state.lastPosition : 0;
    let nextQuestion = getNextQuestionStmt.get(normalizedType, lastPosition) as QuestionForRotation | undefined;

    if (!nextQuestion) {
      nextQuestion = getFirstQuestionStmt.get(normalizedType) as QuestionForRotation | undefined;
      if (!nextQuestion) {
        return null;
      }
    }

    upsertRotationStateStmt.run(normalizedType, nextQuestion.position);
    return nextQuestion;
  });

  return fetch();
};
