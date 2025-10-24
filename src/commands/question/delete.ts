/**
 * Subcommand handler for deleting questions.
 *
 * @module src/commands/question/delete
 */

import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';

/**
 * Handles the 'delete' subcommand for /question.
 *
 * @param interaction - Command interaction context.
 */
export const executeDelete = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const questionId = interaction.options.getString('id', true).toUpperCase();

  const question = questionService.getQuestionById(questionId);
  if (!question) {
    await interaction.reply({
      content: `Question \`${questionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  questionService.deleteQuestion(questionId);
  await interaction.reply({
    content: `Question \`${questionId}\` has been deleted.`,
    flags: MessageFlags.Ephemeral,
  });
};
