/**
 * Modal handler for processing submission rejection with reason.
 *
 * @module src/interactions/modals/approvalRejectModal
 */

import { MessageFlags, ModalSubmitInteraction, Client } from 'discord.js';
import * as submissionService from '../../services/submissionService.js';
import { updateSubmissionMessageStatus, notifySubmitter } from '../../services/approvalService.js';
import logger from '../../utils/logger.js';

/**
 * Handles the submission of the rejection modal.
 *
 * @param interaction - Modal submit interaction context.
 * @param client - Discord client used for messaging.
 * @param submissionId - The submission ID being rejected.
 */
export const handleRejectModalSubmit = async (
  interaction: ModalSubmitInteraction,
  client: Client,
  submissionId: string
): Promise<void> => {
  const reason = interaction.fields.getTextInputValue('reason')?.trim() || undefined;

  const submission = submissionService.getSubmissionById(submissionId);

  if (!submission) {
    await interaction.reply({
      content: `Submission \`${submissionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (submission.status !== 'pending') {
    await interaction.reply({
      content: `Submission \`${submissionId}\` has already been processed.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Defer the reply to avoid timeout
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Update submission status
    submissionService.updateSubmissionStatus({
      submissionId,
      status: 'rejected',
      resolverId: interaction.user.id,
    });
    submission.status = 'rejected';
    submission.resolver_id = interaction.user.id;

    // Update the approval message
    await updateSubmissionMessageStatus({
      client,
      submission,
      status: 'rejected',
      approverId: interaction.user.id,
      notes: reason || undefined,
    });

    // Notify the submitter
    await notifySubmitter({
      client,
      userId: submission.user_id,
      status: 'rejected',
      reason,
    });

    await interaction.editReply({
      content: `Submission \`${submissionId}\` was rejected.`,
    });

    logger.info('Rejected submission via button', {
      submissionId,
      resolverId: interaction.user.id,
      reason: reason || 'No reason provided',
    });
  } catch (error) {
    logger.error('Error rejecting submission via button', {
      error,
      submissionId,
      resolverId: interaction.user.id,
    });

    await interaction.editReply({
      content: 'An error occurred while rejecting the submission.',
    });
  }
};
