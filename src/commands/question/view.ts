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
 * Displays detailed information about a specific question including:
 * - Question text
 * - Question ID
 * - Type (Truth/Dare)
 * - Position in rotation queue
 * - Last updated timestamp
 *
 * @param interaction - Command interaction context with question ID parameter.
 * @returns Promise that resolves when the question details are displayed.
 *
 * @example
 * Moderator executes: /question view id:8A3F2D1C
 * Bot displays an embed with full question details
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
