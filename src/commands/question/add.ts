/**
 * Subcommand handler for adding questions.
 *
 * @module src/commands/question/add
 */

import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import { findSimilarQuestions } from '../../services/similarityService.js';
import { storePendingSubmission } from '../../utils/pendingSubmissionCache.js';
import { formatSimilarQuestions, buildSimilarityWarningEmbed, buildAddSimilarityWarningButtons } from '../../utils/similarityWarning.js';
import { buildQuestionDetailEmbed } from './shared.js';
import logger from '../../utils/logger.js';

/**
 * Handles the 'add' subcommand for /question.
 *
 * Allows moderators to directly add questions without going through the approval process.
 * Questions are added to the end of the rotation queue and assigned a unique 8-character ID.
 *
 * Requirements:
 * - Both type and text parameters must be provided
 * - Text must not be empty after trimming
 *
 * The added question is immediately available in the rotation queue for /truth or /dare commands.
 *
 * @param interaction - Command interaction context with type and text options.
 * @returns Promise that resolves when the question is added and reply is sent.
 *
 * @example
 * Moderator executes: /question add type:truth text:"What is your biggest accomplishment?"
 * Bot responds with: "New question added with ID: 8A3F2D1C" (with embed showing details)
 */
export const executeAdd = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const type = interaction.options.getString('type');
  const text = interaction.options.getString('text');

  if (!type || !text) {
    logger.warn('Question add command missing required parameters', {
      userId: interaction.user.id,
      hasType: !!type,
      hasText: !!text
    });
    await interaction.reply({
      content: 'Please provide both `type` and `text` to add a new question directly.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const trimmed = text.trim();
  if (!trimmed.length) {
    logger.warn('Question add command received empty text', {
      userId: interaction.user.id,
      type
    });
    await interaction.reply({
      content: 'Question text cannot be empty.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const questionType = type as questionService.QuestionType;

  // Check for similar questions before adding
  const similarQuestions = findSimilarQuestions(trimmed, questionType, 0.7, 5);

  if (similarQuestions.length > 0) {
    logger.info('Similar questions found for direct add', {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      type: questionType,
      similarCount: similarQuestions.length,
      topSimilarity: similarQuestions[0]?.similarityScore,
    });

    const similarityText = formatSimilarQuestions(similarQuestions);
    const embed = buildSimilarityWarningEmbed(similarityText, trimmed);

    const pendingId = storePendingSubmission({
      type: questionType,
      text: trimmed,
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      source: 'add',
    });

    const actionRow = buildAddSimilarityWarningButtons(pendingId);

    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const question = questionService.addQuestion({
      type,
      text: trimmed,
      createdBy: interaction.user.id,
    });

    logger.info('Question added via command', {
      questionId: question.question_id,
      type: question.type,
      userId: interaction.user.id,
      guildId: interaction.guildId
    });

    await interaction.reply({
      content: `New question added with ID: \`${question.question_id}\``,
      embeds: [buildQuestionDetailEmbed(question)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    logger.error('Failed to add question via command', {
      error,
      type,
      userId: interaction.user.id,
      guildId: interaction.guildId
    });
    await interaction.reply({
      content: 'Failed to add question. Please try again later.',
      flags: MessageFlags.Ephemeral,
    });
  }
};
