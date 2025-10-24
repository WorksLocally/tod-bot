/**
 * Subcommand handler for rejecting submissions.
 *
 * @module src/commands/question/reject
 */

import { MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
import * as submissionService from '../../services/submissionService.js';
import { updateSubmissionMessageStatus, notifySubmitter } from '../../services/approvalService.js';

/**
 * Handles the 'reject' subcommand for /question.
 *
 * @param interaction - Command interaction context.
 * @param client - Discord client used for messaging.
 */
export const executeReject = async (
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> => {
  const submissionId = interaction.options.getString('submission-id', true).toUpperCase();
  const reason = interaction.options.getString('reason')?.trim();

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
      content: `Submission \`${submissionId}\` was already processed.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  submissionService.updateSubmissionStatus({
    submissionId,
    status: 'rejected',
    resolverId: interaction.user.id,
  });
  submission.status = 'rejected';
  submission.resolver_id = interaction.user.id;

  await updateSubmissionMessageStatus({
    client,
    submission,
    status: 'rejected',
    approverId: interaction.user.id,
    notes: reason || undefined,
  });

  await notifySubmitter({
    client,
    userId: submission.user_id,
    status: 'rejected',
    reason,
  });

  await interaction.reply({
    content: `Submission \`${submissionId}\` was rejected.`,
    flags: MessageFlags.Ephemeral,
  });
};
