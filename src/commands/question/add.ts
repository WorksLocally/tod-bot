/**
 * Subcommand handler for adding questions or approving submissions.
 *
 * @module src/commands/question/add
 */

import { MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import * as questionService from '../../services/questionService.js';
import { buildQuestionDetailEmbed } from './shared.js';

/**
 * Handles the 'add' subcommand for /question.
 *
 * @param interaction - Command interaction context.
 */
export const executeAdd = async (
  interaction: ChatInputCommandInteraction
): Promise<void> => {
  const type = interaction.options.getString('type');
  const text = interaction.options.getString('text');

  if (!type || !text) {
    await interaction.reply({
      content: 'Please provide both `type` and `text` to add a new question directly.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const trimmed = text.trim();
  if (!trimmed.length) {
    await interaction.reply({
      content: 'Question text cannot be empty.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const question = questionService.addQuestion({
    type,
    text: trimmed,
    createdBy: interaction.user.id,
  });

  await interaction.reply({
    content: `New question added with ID: \`${question.question_id}\``,
    embeds: [buildQuestionDetailEmbed(question)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
};
