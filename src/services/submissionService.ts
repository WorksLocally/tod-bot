/**
 * Persistence layer for tracking user question submissions awaiting moderation.
 *
 * @module src/services/submissionService
 */

import db from '../database/client.js';
import { generateSubmissionId } from '../utils/id.js';
import { sanitizeText } from '../utils/sanitize.js';
import type { QuestionType } from './questionService.js';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface SubmissionRecord {
  submission_id: string;
  type: QuestionType;
  text: string;
  user_id: string;
  guild_id: string | null;
  status: SubmissionStatus;
  created_at: string | null;
  resolved_at: string | null;
  resolver_id: string | null;
  approval_message_id: string | null;
  approval_channel_id: string | null;
}

// Prepared statements cached for performance
const STATEMENTS = {
  insertSubmission: db.prepare(
    'INSERT INTO submissions (submission_id, type, text, user_id, guild_id, status, approval_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  updateStatus: db.prepare(
    `UPDATE submissions
       SET status = ?,
           resolved_at = CASE WHEN ? IN ('approved', 'rejected') THEN datetime('now') ELSE resolved_at END,
           resolver_id = CASE WHEN ? IN ('approved', 'rejected') THEN ? ELSE resolver_id END
     WHERE submission_id = ?`
  ),
  setApprovalMessage: db.prepare(
    'UPDATE submissions SET approval_message_id = ?, approval_channel_id = ? WHERE submission_id = ?'
  ),
  getSubmissionById: db.prepare(
    'SELECT * FROM submissions WHERE submission_id = ?'
  ),
  listPendingSubmissions: db.prepare(
    "SELECT * FROM submissions WHERE status = 'pending' ORDER BY created_at ASC"
  ),
} as const;

interface CreateSubmissionParams {
  type: QuestionType;
  text: string;
  userId: string;
  guildId?: string;
  approvalChannelId?: string;
}

/**
 * Creates a submission for later moderation review.
 *
 * @param params - Submission payload.
 * @returns Persisted submission record.
 */
export const createSubmission = ({ type, text, userId, guildId, approvalChannelId }: CreateSubmissionParams): SubmissionRecord => {
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    throw new Error('Submission text cannot be empty.');
  }

  let submissionId: string = '';
  let inserted = false;

  while (!inserted) {
    submissionId = generateSubmissionId();
    try {
      STATEMENTS.insertSubmission.run(
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
      if ((error as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE') {
        throw error;
      }
    }
  }

  return STATEMENTS.getSubmissionById.get(submissionId) as SubmissionRecord;
};

interface UpdateSubmissionStatusParams {
  submissionId: string;
  status: SubmissionStatus;
  resolverId?: string;
}

/**
 * Updates the status of a submission and records resolver metadata when applicable.
 *
 * @param params - Update payload.
 * @returns Count of affected rows.
 */
export const updateSubmissionStatus = ({ submissionId, status, resolverId }: UpdateSubmissionStatusParams): number => {
  const info = STATEMENTS.updateStatus.run(
    status,
    status,
    status,
    resolverId || null,
    submissionId
  );
  return info.changes;
};

interface SetApprovalMessageParams {
  submissionId: string;
  messageId: string;
  channelId: string;
}

/**
 * Stores the message and channel identifiers for the submission approval post.
 *
 * @param params - Reference metadata.
 * @returns Count of affected rows.
 */
export const setApprovalMessage = ({ submissionId, messageId, channelId }: SetApprovalMessageParams): number => {
  const info = STATEMENTS.setApprovalMessage.run(messageId, channelId, submissionId);
  return info.changes;
};

/**
 * Retrieves a submission by its identifier.
 *
 * @param submissionId - Identifier to query.
 * @returns Found submission, if any.
 */
export const getSubmissionById = (submissionId: string): SubmissionRecord | undefined => {
  return STATEMENTS.getSubmissionById.get(submissionId) as SubmissionRecord | undefined;
};

/**
 * Lists all submissions that have not yet been moderated.
 *
 * @returns Pending submission records.
 */
export const listPendingSubmissions = (): SubmissionRecord[] => {
  return STATEMENTS.listPendingSubmissions.all() as SubmissionRecord[];
};
