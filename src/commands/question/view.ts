/**
 * Subcommand handler for viewing a single question.
 *
 * @module src/commands/question/view
 */

import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import { buildQuestionDetailEmbed } from './shared.js';

/**
 * Handles the 'view' subcommand for /question.
 *
 * @param interaction - Command interaction context.
 */
export const executeView = async (
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

  await interaction.reply({
    embeds: [buildQuestionDetailEmbed(question)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
};
