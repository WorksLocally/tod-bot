const db = require('../database/client');
const { generateQuestionId } = require('../utils/id');

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

const addQuestion = ({ type, text, createdBy }) => {
  const insert = db.transaction(() => {
    const maxPosition = getMaxPositionStmt.get(type).maxPosition;
    const position = maxPosition + 1;

    let questionId;
    let inserted = false;

    while (!inserted) {
      questionId = generateQuestionId();
      try {
        insertQuestionStmt.run(questionId, type, text, createdBy || null, position);
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

const editQuestion = ({ questionId, text }) => {
  const info = updateQuestionStmt.run(text, questionId);
  return info.changes;
};

const deleteQuestion = (questionId) => {
  const info = deleteQuestionStmt.run(questionId);
  return info.changes;
};

const getQuestionById = (questionId) => getQuestionByIdStmt.get(questionId);

const listQuestions = (type) => {
  if (type) {
    return listQuestionsByTypeStmt.all(type);
  }
  return listQuestionsStmt.all();
};

const getNextQuestion = (type) => {
  const fetch = db.transaction(() => {
    const state = getRotationStateStmt.get(type);
    const lastPosition = state ? state.lastPosition : 0;
    let nextQuestion = getNextQuestionStmt.get(type, lastPosition);

    if (!nextQuestion) {
      nextQuestion = getFirstQuestionStmt.get(type);
      if (!nextQuestion) {
        return null;
      }
    }

    upsertRotationStateStmt.run(type, nextQuestion.position);
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
