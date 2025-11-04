/**
 * Subcommand handler for editing questions.
 *
 * @module src/commands/question/edit
 */

import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import { buildQuestionDetailEmbed } from './shared.js';
import logger from '../../utils/logger.js';

/**
 * Handles the 'edit' subcommand for /question.
 *
 * Updates the text of an existing question while preserving its ID, type, and position.
 * The updated_at timestamp is automatically updated to reflect the modification.
 *
 * @param interaction - Command interaction context with question ID and new text.
 * @returns Promise that resolves when the question is updated and reply is sent.
 * @remarks Errors such as "question not found" or "update fails" are handled by sending an error reply to the user, not by throwing exceptions.
 *
 * @example
 * Moderator executes: /question edit id:8A3F2D1C text:"Updated question text"
 * Bot responds with: "Question 8A3F2D1C has been updated" (with embed showing new details)
 */
export const executeEdit = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const questionId = interaction.options.getString('id', true).toUpperCase();
  const newText = interaction.options.getString('text', true).trim();

  const question = questionService.getQuestionById(questionId);
  if (!question) {
    logger.warn('Attempted to edit non-existent question via command', {
      questionId,
      userId: interaction.user.id,
      guildId: interaction.guildId
    });
    await interaction.reply({
      content: `Question \`${questionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const updated = questionService.editQuestion({ questionId, text: newText });

    if (!updated) {
      logger.warn('Question not found during edit operation', {
        questionId,
        userId: interaction.user.id,
        guildId: interaction.guildId
      });
      await interaction.reply({
        content: `Question \`${questionId}\` was not found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    logger.info('Question edited via command', {
      questionId,
      type: updated.type,
      userId: interaction.user.id,
      guildId: interaction.guildId
    });

    await interaction.reply({
      content: `Question \`${questionId}\` has been updated.`,
      embeds: [buildQuestionDetailEmbed(updated)],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    logger.error('Failed to edit question via command', {
      error,
      questionId,
      userId: interaction.user.id,
      guildId: interaction.guildId
    });
    await interaction.reply({
      content: `Unable to update question: ${(error as Error).message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
};
