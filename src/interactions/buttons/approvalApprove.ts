/**
 * Button handler for approving submissions via approval message buttons.
 *
 * @module src/interactions/buttons/approvalApprove
 */

import { MessageFlags, ButtonInteraction, Client, GuildMember } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import * as submissionService from '../../services/submissionService.js';
import { updateSubmissionMessageStatus, notifySubmitter } from '../../services/approvalService.js';
import logger from '../../utils/logger.js';
import type { BotConfig } from '../../config/env.js';
import { hasPrivilegedRole } from '../../utils/permissions.js';

export const customId = 'approval_approve';

/**
 * Handles approval button interactions on submission messages.
 *
 * @param interaction - Button interaction context.
 * @param client - Discord client used for messaging.
 * @param config - Application configuration.
 */
export const execute = async (
  interaction: ButtonInteraction,
  client: Client,
  config: BotConfig
): Promise<void> => {
  // Check permissions
  const member = interaction.member as GuildMember | null;
  if (!hasPrivilegedRole(member, config.privilegedRoleIds)) {
    await interaction.reply({
      content: 'You do not have permission to approve submissions.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Extract submission ID from the message embed
  const embed = interaction.message.embeds[0];
  if (!embed) {
    await interaction.reply({
      content: 'Unable to find submission information.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const submissionIdField = embed.fields.find((f) => f.name === 'Submission ID');
  if (!submissionIdField) {
    await interaction.reply({
      content: 'Unable to find submission ID.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const submissionId = submissionIdField.value.trim().toUpperCase();
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
    // Add the question
    const question = questionService.addQuestion({
      type: submission.type,
      text: submission.text,
      createdBy: submission.user_id,
    });

    // Update submission status
    submissionService.updateSubmissionStatus({
      submissionId,
      status: 'approved',
      resolverId: interaction.user.id,
    });
    submission.status = 'approved';
    submission.resolver_id = interaction.user.id;

    // Update the approval message
    await updateSubmissionMessageStatus({
      client,
      submission,
      status: 'approved',
      questionId: question.question_id,
      approverId: interaction.user.id,
    });

    // Notify the submitter
    await notifySubmitter({
      client,
      userId: submission.user_id,
      status: 'approved',
      questionId: question.question_id,
    });

    await interaction.editReply({
      content: `Submission \`${submissionId}\` approved. New question ID: \`${question.question_id}\``,
    });

    logger.info('Approved submission via button', {
      submissionId,
      questionId: question.question_id,
      approverId: interaction.user.id,
    });
  } catch (error) {
    logger.error('Error approving submission via button', {
      error,
      submissionId,
      approverId: interaction.user.id,
    });

    await interaction.editReply({
      content: 'An error occurred while approving the submission.',
    });
  }
};
