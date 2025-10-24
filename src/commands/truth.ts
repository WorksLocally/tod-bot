/**
 * Slash command implementation for serving the next truth question.
 *
 * @module src/commands/truth
 */

import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { getNextQuestion } from '../services/questionService.js';
import { buildQuestionEmbed, buildQuestionComponents } from '../utils/questionEmbeds.js';

export const data = new SlashCommandBuilder()
  .setName('truth')
  .setDescription('Get the next truth question.');

/**
 * Handles execution of the `/truth` command by replying with the next truth prompt.
 *
 * @param interaction - Interaction payload from Discord.
 */
export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const question = getNextQuestion('truth');

  if (!question) {
    await interaction.reply({
      content: 'There are no truth questions available yet.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildQuestionEmbed({
    question,
    requestedBy: (interaction.member as GuildMember | null) ?? interaction.user,
  });

  await interaction.reply({
    embeds: [embed],
    components: buildQuestionComponents(),
    allowedMentions: { parse: [] },
  });
};
