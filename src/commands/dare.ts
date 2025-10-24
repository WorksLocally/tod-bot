/**
 * Slash command implementation for serving the next dare question.
 *
 * @module src/commands/dare
 */

import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction } from 'discord.js';
import { getNextQuestion } from '../services/questionService.js';
import { buildQuestionEmbed, buildQuestionComponents } from '../utils/questionEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('dare')
  .setDescription('Get the next dare question.');

/**
 * Handles execution of the `/dare` command by replying with the next dare prompt.
 *
 * @param interaction - Interaction payload from Discord.
 */
export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const question = getNextQuestion('dare');

  if (!question) {
    await interaction.reply({
      content: 'There are no dare questions available yet.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildQuestionEmbed({
    question,
    requestedBy: interaction.member ?? interaction.user,
  });

  await interaction.reply({
    embeds: [embed],
    components: buildQuestionComponents(),
    allowedMentions: { parse: [] },
  });
};
