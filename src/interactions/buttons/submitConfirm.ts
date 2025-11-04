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
 * Handles the submission confirmation button click after similarity warning.
 *
 * This function processes user confirmations when they choose to submit a question
 * despite similarity warnings. It performs the following operations:
 * 1. Parses and validates the pending submission ID from the button custom ID
 * 2. Retrieves the pending submission from the cache (with 10-minute TTL)
 * 3. Verifies the user is the original submitter (security check)
 * 4. Creates the submission in the database
 * 5. Posts to the approval channel for moderator review
 *
 * Security: Multiple validation checks ensure only the original submitter can
 * confirm their own submission, and pending data expires after 10 minutes.
 *
 * @param interaction - Button interaction from the similarity warning message.
 * @param client - Discord client instance for posting approval messages.
 * @param config - Bot configuration containing approval channel ID.
 * @returns Promise that resolves when submission is processed and user is notified.
 *
 * @example
 * User sees similarity warning → clicks "Submit Anyway"
 * → Pending data retrieved and validated
 * → Submission created and posted to approval channel
 * → User notified of successful submission
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
  
  // Validate pendingId: must be exactly 8 alphanumeric characters
  if (!/^[A-Z0-9]{8}$/.test(pendingId)) {
    await interaction.update({
      content: 'Invalid submission data. Please try submitting again using the `/submit` command.',
      embeds: [],
      components: [],
    });
    return;
  }
  
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
