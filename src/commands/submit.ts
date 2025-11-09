/**
 * Slash command implementation enabling users to submit questions for moderation.
 *
 * @module src/commands/submit
 */

import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, Client } from 'discord.js';
import { createSubmission } from '../services/submissionService.js';
import { postSubmissionForApproval } from '../services/approvalService.js';
import { findSimilarQuestions } from '../services/similarityService.js';
import { storePendingSubmission } from '../utils/pendingSubmissionCache.js';
import { formatSimilarQuestions, buildSimilarityWarningEmbed, buildSimilarityWarningButtons } from '../utils/similarityWarning.js';
import { submissionRateLimiter } from '../utils/rateLimiter.js';
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
 * This function implements the complete submission workflow:
 * 1. Validates rate limiting (max 10 submissions per 5 minutes per user)
 * 2. Sanitizes and validates the question text
 * 3. Checks for similar existing questions (70% similarity threshold)
 * 4. If similar questions found: Shows warning and requires confirmation
 * 5. If no similar questions: Creates submission and posts to approval channel
 *
 * The similarity check helps prevent duplicate questions from being submitted.
 * Rate limiting prevents spam and abuse of the submission system.
 *
 * Security: All input is sanitized before processing. Rate limiting prevents abuse.
 *
 * @param interaction - Chat input command interaction from Discord.
 * @param client - Discord client instance for posting approval messages.
 * @param config - Bot configuration containing approval channel ID.
 * @returns Promise that resolves when the submission is processed.
 *
 * @example
 * User executes: /submit type:truth text:"What is your biggest fear?"
 * Bot checks for similar questions and either:
 * - Shows similarity warning with confirmation buttons, or
 * - Creates submission and posts to approval channel
 */
export const execute = async (
  interaction: ChatInputCommandInteraction,
  client: Client,
  config: BotConfig
): Promise<void> => {
  const questionType = interaction.options.getString('type', true) as QuestionType;

  logger.debug('Submit command invoked', {
    type: questionType,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  });

  // Check rate limit
  if (submissionRateLimiter.isRateLimited(interaction.user.id)) {
    const timeUntilReset = submissionRateLimiter.getTimeUntilReset(interaction.user.id);
    const minutesRemaining = Math.ceil(timeUntilReset / 60000);

    await interaction.reply({
      content: `You have submitted too many questions recently. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
      flags: MessageFlags.Ephemeral,
    });

    logger.warn('User rate limited on submission', {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      type: questionType,
      timeUntilReset,
      minutesRemaining,
    });
    return;
  }

  const rawText = interaction.options.getString('text', true);
  const sanitized = sanitizeText(rawText, { maxLength: 4000 });

  logger.debug('Question text sanitized', {
    userId: interaction.user.id,
    type: questionType,
    originalLength: rawText.length,
    sanitizedLength: sanitized.length,
  });

  if (!sanitized.length) {
    logger.warn('Empty question text submitted after sanitization', {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      type: questionType,
    });
    await interaction.reply({
      content: 'Please provide a valid question to submit.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check for similar questions before submission
  const similarQuestions = findSimilarQuestions(
    sanitized,
    questionType,
    0.7, // 70% similarity threshold
    5    // Show top 5 matches
  );

  logger.debug('Similar questions check completed', {
    userId: interaction.user.id,
    type: questionType,
    similarCount: similarQuestions.length,
  });

  // If similar questions are found, show them to the user and ask for confirmation
  if (similarQuestions.length > 0) {
    logger.info('Similar questions found for submission', {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      type: questionType,
      similarCount: similarQuestions.length,
      topSimilarity: similarQuestions[0]?.similarityScore,
    });
    const similarityText = formatSimilarQuestions(similarQuestions);
    const embed = buildSimilarityWarningEmbed(similarityText, sanitized);

    // Store the pending submission data
    const pendingId = storePendingSubmission({
      type: questionType,
      text: sanitized,
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
    });

    const actionRow = buildSimilarityWarningButtons(pendingId);

    logger.debug('Similarity warning displayed to user', {
      userId: interaction.user.id,
      pendingId,
      type: questionType,
    });

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  logger.info('No similar questions found, proceeding with direct submission', {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    type: questionType,
  });

  // No similar questions found, proceed with submission directly
  let submission;
  try {
    submission = createSubmission({
      type: questionType,
      text: sanitized,
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      approvalChannelId: config.approvalChannelId,
    });

    logger.info('Submission stored in database', {
      submissionId: submission.submission_id,
      type: questionType,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
  } catch (error) {
    logger.error('Failed to store submission', {
      error,
      userId: interaction.user.id,
      guildId: interaction.guildId,
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

    logger.info('Submission posted to approval channel successfully', {
      submissionId: submission.submission_id,
      type: questionType,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      approvalChannelId: config.approvalChannelId,
    });

    await interaction.reply({
      content:
        'Your question has been submitted for approval. You will be notified once it has been reviewed.',
      flags: MessageFlags.Ephemeral,
    });

    logger.debug('User notified of successful submission', {
      submissionId: submission.submission_id,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error('Unable to post submission to approval channel', {
      error,
      submissionId: submission.submission_id,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      approvalChannelId: config.approvalChannelId,
    });
    await interaction.reply({
      content:
        'Your submission was saved but we were unable to post it to the approval channel. Please alert a moderator.',
      flags: MessageFlags.Ephemeral,
    });
  }
};
