/**
 * Shared utility functions for validating submissions from button interactions.
 *
 * @module src/interactions/submissionValidation
 */

import { ButtonInteraction, MessageFlags } from 'discord.js';
import * as submissionService from '../services/submissionService.js';
import type { SubmissionRecord } from '../services/submissionService.js';

interface ValidationResult {
  submissionId?: string;
  submission?: SubmissionRecord;
  error?: string;
}

/**
 * Extracts and validates a submission from a button interaction.
 * Handles all validation steps including embed extraction, ID parsing, and status checking.
 *
 * @param interaction - Button interaction context.
 * @returns Object containing submissionId and submission if valid, or error message if invalid.
 */
export const validateSubmissionFromInteraction = async (
  interaction: ButtonInteraction
): Promise<ValidationResult> => {
  // Extract submission ID from the message embed
  const embed = interaction.message.embeds[0];
  if (!embed) {
    await interaction.reply({
      content: 'Unable to find submission information.',
      flags: MessageFlags.Ephemeral,
    });
    return { error: 'Missing embed' };
  }

  const submissionIdField = embed.fields.find((f) => f.name === 'Submission ID');
  if (!submissionIdField) {
    await interaction.reply({
      content: 'Unable to find submission ID.',
      flags: MessageFlags.Ephemeral,
    });
    return { error: 'Missing submission ID field' };
  }

  const submissionId = submissionIdField.value.trim().toUpperCase();
  const submission = submissionService.getSubmissionById(submissionId);

  if (!submission) {
    await interaction.reply({
      content: `Submission \`${submissionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return { error: 'Submission not found' };
  }

  if (submission.status !== 'pending') {
    await interaction.reply({
      content: `Submission \`${submissionId}\` has already been processed.`,
      flags: MessageFlags.Ephemeral,
    });
    return { error: 'Submission already processed' };
  }

  return { submissionId, submission };
};
