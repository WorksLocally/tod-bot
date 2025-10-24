/**
 * Subcommand handler for editing questions.
 *
 * @module src/commands/question/edit
 */

import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import { buildQuestionDetailEmbed } from './shared.js';

/**
 * Handles the 'edit' subcommand for /question.
 *
 * @param interaction - Command interaction context.
 */
export const executeEdit = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const questionId = interaction.options.getString('id', true).toUpperCase();
  const newText = interaction.options.getString('text', true).trim();

  const question = questionService.getQuestionById(questionId);
  if (!question) {
    await interaction.reply({
      content: `Question \`${questionId}\` was not found.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    questionService.editQuestion({ questionId, text: newText });
  } catch (error) {
    await interaction.reply({
      content: `Unable to update question: ${(error as Error).message}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const updated = questionService.getQuestionById(questionId);

  await interaction.reply({
    content: `Question \`${questionId}\` has been updated.`,
    embeds: [buildQuestionDetailEmbed(updated!)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
};
