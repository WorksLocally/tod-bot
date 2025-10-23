const db = require('../database/client');
const { generateSubmissionId } = require('../utils/id');

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

const createSubmission = ({ type, text, userId, guildId, approvalChannelId }) => {
  let submissionId;
  let inserted = false;

  while (!inserted) {
    submissionId = generateSubmissionId();
    try {
      insertSubmissionStmt.run(
        submissionId,
        type,
        text,
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

const updateSubmissionStatus = ({ submissionId, status, resolverId }) => {
  const info = updateStatusStmt.run(status, status, resolverId || null, resolverId || null, submissionId);
  return info.changes;
};

const setApprovalMessage = ({ submissionId, messageId, channelId }) => {
  const info = setApprovalMessageStmt.run(messageId, channelId, submissionId);
  return info.changes;
};

const getSubmissionById = (submissionId) => getSubmissionByIdStmt.get(submissionId);

const listPendingSubmissions = () => listPendingSubmissionsStmt.all();

module.exports = {
  createSubmission,
  updateSubmissionStatus,
  setApprovalMessage,
  getSubmissionById,
  listPendingSubmissions,
};
