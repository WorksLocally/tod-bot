/**
 * Slash command implementation enabling users to submit questions for moderation.
 *
 * @module src/commands/submit
 */

import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
import { createSubmission } from '../services/submissionService.js';
import { postSubmissionForApproval } from '../services/approvalService.js';
import logger from '../utils/logger.js';
import { sanitizeText } from '../utils/sanitize.js';
import type { BotConfig } from '../config/env.js';
import type { QuestionType } from '../services/questionService.js';

export const data = new SlashCommandBuilder()
  .setName('submit')
  .setDescription('Submit a truth or dare question for approval.')
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription('The type of question.')
      .setRequired(true)
      .addChoices(
        { name: 'Truth', value: 'truth' },
        { name: 'Dare', value: 'dare' },
      ),
  )
  .addStringOption((option) =>
    option
      .setName('text')
      .setDescription('The question you would like to submit.')
      .setRequired(true)
      .setMaxLength(4000),
  );

/**
 * Processes `/submit` requests by storing the question and notifying moderators.
 *
 * @param interaction - Interaction payload from Discord.
 * @param client - Discord client used to post approval messages.
 * @param config - Application configuration.
 */
export const execute = async (
  interaction: ChatInputCommandInteraction,
  client: Client,
  config: BotConfig
): Promise<void> => {
  const questionType = interaction.options.getString('type', true) as QuestionType;
  const rawText = interaction.options.getString('text', true);
  const sanitized = sanitizeText(rawText, { maxLength: 4000 });

  if (!sanitized.length) {
    await interaction.reply({
      content: 'Please provide a valid question to submit.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let submission;
  try {
    submission = createSubmission({
      type: questionType,
      text: sanitized,
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      approvalChannelId: config.approvalChannelId,
    });
  } catch (error) {
    logger.error('Failed to store submission', {
      error,
      userId: interaction.user.id,
      type: questionType,
    });
    await interaction.reply({
      content:
        'We were unable to process your submission. Please try again later or contact a moderator.',
      flags: MessageFlags.Ephemeral,
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

    await interaction.reply({
      content:
        'Your question has been submitted for approval. You will be notified once it has been reviewed.',
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error('Unable to post submission to approval channel', {
      error,
      submissionId: submission.submission_id,
      userId: interaction.user.id,
    });
    await interaction.reply({
      content:
        'Your submission was saved but we were unable to post it to the approval channel. Please alert a moderator.',
      flags: MessageFlags.Ephemeral,
    });
  }
};
