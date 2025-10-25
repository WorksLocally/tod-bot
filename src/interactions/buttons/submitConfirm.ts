/**
 * Button handler for confirming question submission after similarity warning.
 *
 * @module src/interactions/buttons/submitConfirm
 */

import { ButtonInteraction, Client } from 'discord.js';
import { createSubmission } from '../../services/submissionService.js';
import { postSubmissionForApproval } from '../../services/approvalService.js';
import logger from '../../utils/logger.js';
import type { BotConfig } from '../../config/env.js';
import type { QuestionType } from '../../services/questionService.js';

/**
 * Matches custom IDs starting with 'submit_confirm:'.
 */
export const match = (customId: string): boolean => customId.startsWith('submit_confirm:');

/**
 * Handles the submission confirmation button click.
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
  // Parse the custom ID to extract question type and text
  // Format: submit_confirm:type:base64EncodedText
  const parts = interaction.customId.split(':');
  
  if (parts.length !== 3) {
    await interaction.update({
      content: 'Invalid submission data. Please try submitting again using the `/submit` command.',
      embeds: [],
      components: [],
    });
    return;
  }

  const questionType = parts[1] as QuestionType;
  let questionText: string;
  
  try {
    questionText = Buffer.from(parts[2], 'base64').toString('utf-8');
  } catch (error) {
    logger.error('Failed to decode question text from button interaction', { error });
    await interaction.update({
      content: 'Failed to decode question data. Please try submitting again using the `/submit` command.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Validate question type
  if (questionType !== 'truth' && questionType !== 'dare') {
    await interaction.update({
      content: 'Invalid question type. Please try submitting again using the `/submit` command.',
      embeds: [],
      components: [],
    });
    return;
  }

  let submission;
  try {
    submission = createSubmission({
      type: questionType,
      text: questionText,
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      approvalChannelId: config.approvalChannelId,
    });
  } catch (error) {
    logger.error('Failed to store submission from confirm button', {
      error,
      userId: interaction.user.id,
      type: questionType,
    });
    await interaction.update({
      content:
        'We were unable to process your submission. Please try again later or contact a moderator.',
      embeds: [],
      components: [],
    });
    return;
  }

  try {
    await postSubmissionForApproval({
      client,
      config,
      submission,
      user: interaction.user,
    });

    await interaction.update({
      content:
        '✅ Your question has been submitted for approval. You will be notified once it has been reviewed.',
      embeds: [],
      components: [],
    });
  } catch (error) {
    logger.error('Unable to post submission to approval channel from confirm button', {
      error,
      submissionId: submission.submission_id,
      userId: interaction.user.id,
    });
    await interaction.update({
      content:
        'Your submission was saved but we were unable to post it to the approval channel. Please alert a moderator.',
      embeds: [],
      components: [],
    });
  }
};
