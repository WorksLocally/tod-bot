/**
 * Persistence layer for tracking user question submissions awaiting moderation.
 *
 * @module src/services/submissionService
 */

const db = require('../database/client');
const { generateSubmissionId } = require('../utils/id');
const { sanitizeText } = require('../utils/sanitize');

/**
 * @typedef {Object} SubmissionRecord
 * @property {string} submission_id - Unique submission identifier.
 * @property {'truth' | 'dare'} type - Submitted question type.
 * @property {string} text - Submission content.
 * @property {string} user_id - Discord user ID of the submitter.
 * @property {string | null} guild_id - Guild context, if provided.
 * @property {'pending' | 'approved' | 'rejected'} status - Moderation status.
 * @property {string | null} created_at - ISO timestamp of creation.
 * @property {string | null} resolved_at - ISO timestamp of moderation.
 * @property {string | null} resolver_id - Moderator who processed the submission.
 * @property {string | null} approval_message_id - Discord message ID associated with the submission.
 * @property {string | null} approval_channel_id - Channel ID where submission message resides.
 */

const insertSubmissionStmt = db.prepare(
  'INSERT INTO submissions (submission_id, type, text, user_id, guild_id, status, approval_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const updateStatusStmt = db.prepare(
  `UPDATE submissions
     SET status = ?,
         resolved_at = CASE WHEN ? IN ('approved', 'rejected') THEN datetime('now') ELSE resolved_at END,
         resolver_id = CASE WHEN ? IN ('approved', 'rejected') THEN ? ELSE resolver_id END
   WHERE submission_id = ?`
);
const setApprovalMessageStmt = db.prepare(
  'UPDATE submissions SET approval_message_id = ?, approval_channel_id = ? WHERE submission_id = ?'
);
const getSubmissionByIdStmt = db.prepare(
  'SELECT * FROM submissions WHERE submission_id = ?'
);
const listPendingSubmissionsStmt = db.prepare(
  "SELECT * FROM submissions WHERE status = 'pending' ORDER BY created_at ASC"
);

/**
 * Creates a submission for later moderation review.
 *
 * @param {{ type: 'truth' | 'dare', text: string, userId: string, guildId?: string, approvalChannelId?: string }} params -
 *   Submission payload.
 * @returns {SubmissionRecord} - Persisted submission record.
 */
const createSubmission = ({ type, text, userId, guildId, approvalChannelId }) => {
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    throw new Error('Submission text cannot be empty.');
  }

  let submissionId;
  let inserted = false;

  while (!inserted) {
    submissionId = generateSubmissionId();
    try {
      insertSubmissionStmt.run(
        submissionId,
        type,
        sanitizedText,
        userId,
        guildId || null,
        'pending',
        approvalChannelId || null
      );
      inserted = true;
    } catch (error) {
      if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
        throw error;
      }
    }
  }

  return getSubmissionByIdStmt.get(submissionId);
};

/**
 * Updates the status of a submission and records resolver metadata when applicable.
 *
 * @param {{ submissionId: string, status: 'pending' | 'approved' | 'rejected', resolverId?: string }} params - Update payload.
 * @returns {number} - Count of affected rows.
 */
const updateSubmissionStatus = ({ submissionId, status, resolverId }) => {
  const info = updateStatusStmt.run(
    status,
    status,
    status,
    resolverId || null,
    submissionId
  );
  return info.changes;
};

/**
 * Stores the message and channel identifiers for the submission approval post.
 *
 * @param {{ submissionId: string, messageId: string, channelId: string }} params - Reference metadata.
 * @returns {number} - Count of affected rows.
 */
const setApprovalMessage = ({ submissionId, messageId, channelId }) => {
  const info = setApprovalMessageStmt.run(messageId, channelId, submissionId);
  return info.changes;
};

/**
 * Retrieves a submission by its identifier.
 *
 * @param {string} submissionId - Identifier to query.
 * @returns {SubmissionRecord | undefined} - Found submission, if any.
 */
const getSubmissionById = (submissionId) => getSubmissionByIdStmt.get(submissionId);

/**
 * Lists all submissions that have not yet been moderated.
 *
 * @returns {SubmissionRecord[]} - Pending submission records.
 */
const listPendingSubmissions = () => listPendingSubmissionsStmt.all();

module.exports = {
  createSubmission,
  updateSubmissionStatus,
  setApprovalMessage,
  getSubmissionById,
  listPendingSubmissions,
};
