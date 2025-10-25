/**
 * Button handler for confirming question submission after similarity warning.
 *
 * @module src/interactions/buttons/submitConfirm
 */

import { ButtonInteraction, Client } from 'discord.js';
import { createSubmission } from '../../services/submissionService.js';
import { postSubmissionForApproval } from '../../services/approvalService.js';
import { retrievePendingSubmission } from '../../utils/pendingSubmissionCache.js';
import logger from '../../utils/logger.js';
import type { BotConfig } from '../../config/env.js';

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
  // Parse the custom ID to extract the pending submission ID
  // Format: submit_confirm:pendingId
  const parts = interaction.customId.split(':');
  
  if (parts.length !== 2) {
    await interaction.update({
      content: 'Invalid submission data. Please try submitting again using the `/submit` command.',
      embeds: [],
      components: [],
    });
    return;
  }

  const pendingId = parts[1];
  const pendingData = retrievePendingSubmission(pendingId);
  
  if (!pendingData) {
    await interaction.update({
      content: 'This submission confirmation has expired or is no longer valid. Please submit your question again using the `/submit` command.',
      embeds: [],
      components: [],
    });
    return;
  }

  // Verify the user is the same one who initiated the submission
  if (pendingData.userId !== interaction.user.id) {
    await interaction.update({
      content: 'You can only confirm your own submissions.',
      embeds: [],
      components: [],
    });
    return;
  }

  let submission;
  try {
    submission = createSubmission({
      type: pendingData.type,
      text: pendingData.text,
      userId: pendingData.userId,
      guildId: pendingData.guildId,
      approvalChannelId: config.approvalChannelId,
    });
  } catch (error) {
    logger.error('Failed to store submission from confirm button', {
      error,
      userId: interaction.user.id,
      type: pendingData.type,
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
