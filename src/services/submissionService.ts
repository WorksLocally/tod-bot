/**
 * Persistence layer for tracking user question submissions awaiting moderation.
 *
 * @module src/services/submissionService
 */

import db from '../database/client.js';
import { generateSubmissionId } from '../utils/id.js';
import { sanitizeText } from '../utils/sanitize.js';
import type { QuestionType } from './questionService.js';
import logger from '../utils/logger.js';

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
 * This function creates a new pending submission record in the database with:
 * - A unique 6-character alphanumeric submission ID
 * - Sanitized question text (max 4000 characters)
 * - Initial status of 'pending'
 * - Current timestamp for created_at
 *
 * The submission will appear in the approval channel for moderators to review.
 *
 * Security: Input text is sanitized to remove control characters and prevent
 * injection attacks. Prepared statements protect against SQL injection.
 *
 * @param params - Submission payload with question details.
 * @param params.type - Question type ('truth' or 'dare').
 * @param params.text - Question text submitted by user (will be sanitized).
 * @param params.userId - Discord user ID of the submitter.
 * @param params.guildId - Optional Discord guild/server ID where submitted.
 * @param params.approvalChannelId - Optional channel ID where approval message will be posted.
 * @returns Persisted submission record with generated submission_id.
 * @throws {Error} If submission text is empty after sanitization.
 * @throws {Error} If database insertion fails.
 *
 * @example
 * ```typescript
 * const submission = createSubmission({
 *   type: 'truth',
 *   text: 'What is your biggest regret?',
 *   userId: '123456789012345678',
 *   guildId: '987654321098765432',
 *   approvalChannelId: '111222333444555666'
 * });
 * console.log(submission.submission_id); // 'A3F2D1'
 * console.log(submission.status); // 'pending'
 * ```
 */
export const createSubmission = ({ type, text, userId, guildId, approvalChannelId }: CreateSubmissionParams): SubmissionRecord => {
  const sanitizedText = sanitizeText(text, { maxLength: 4000 });
  if (!sanitizedText.length) {
    logger.error('Attempted to create submission with empty text after sanitization', {
      type,
      userId,
      originalLength: text.length
    });
    throw new Error('Submission text cannot be empty.');
  }

  let submissionId: string = '';
  let inserted = false;
  let retryCount = 0;

  try {
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
          logger.error('Failed to insert submission due to database error', {
            error,
            type,
            userId,
            guildId
          });
          throw error;
        }
        retryCount++;
        if (retryCount > 10) {
          logger.error('Failed to generate unique submission ID after multiple attempts', {
            type,
            userId,
            retryCount
          });
          throw new Error('Failed to generate unique submission ID');
        }
      }
    }

    const submission = STATEMENTS.getSubmissionById.get(submissionId) as SubmissionRecord;

    logger.info('Successfully created submission', {
      submissionId,
      type,
      userId,
      guildId,
      approvalChannelId,
      textLength: sanitizedText.length
    });

    return submission;
  } catch (error) {
    logger.error('Failed to create submission', { error, type, userId, guildId });
    throw error;
  }
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
  try {
    const info = STATEMENTS.updateStatus.run(
      status,
      status,
      status,
      resolverId || null,
      submissionId
    );

    if (info.changes > 0) {
      logger.info('Successfully updated submission status', {
        submissionId,
        status,
        resolverId,
        rowsAffected: info.changes
      });
    } else {
      logger.warn('Attempted to update status of non-existent submission', {
        submissionId,
        status
      });
    }

    return info.changes;
  } catch (error) {
    logger.error('Failed to update submission status', {
      error,
      submissionId,
      status,
      resolverId
    });
    throw error;
  }
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
  try {
    const info = STATEMENTS.setApprovalMessage.run(messageId, channelId, submissionId);

    if (info.changes > 0) {
      logger.info('Successfully set approval message reference', {
        submissionId,
        messageId,
        channelId
      });
    } else {
      logger.warn('Attempted to set approval message for non-existent submission', {
        submissionId,
        messageId,
        channelId
      });
    }

    return info.changes;
  } catch (error) {
    logger.error('Failed to set approval message reference', {
      error,
      submissionId,
      messageId,
      channelId
    });
    throw error;
  }
};

/**
 * Retrieves a submission by its identifier.
 *
 * @param submissionId - Identifier to query.
 * @returns Found submission, if any.
 */
export const getSubmissionById = (submissionId: string): SubmissionRecord | undefined => {
  try {
    const submission = STATEMENTS.getSubmissionById.get(submissionId) as SubmissionRecord | undefined;

    if (submission) {
      logger.debug('Retrieved submission by ID', {
        submissionId,
        type: submission.type,
        status: submission.status
      });
    } else {
      logger.debug('Submission not found', { submissionId });
    }

    return submission;
  } catch (error) {
    logger.error('Failed to retrieve submission by ID', { error, submissionId });
    throw error;
  }
};

/**
 * Lists all submissions that have not yet been moderated.
 *
 * @returns Pending submission records.
 */
export const listPendingSubmissions = (): SubmissionRecord[] => {
  try {
    const submissions = STATEMENTS.listPendingSubmissions.all() as SubmissionRecord[];
    logger.debug('Listed pending submissions', { count: submissions.length });
    return submissions;
  } catch (error) {
    logger.error('Failed to list pending submissions', { error });
    throw error;
  }
};
