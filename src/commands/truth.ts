/**
 * Slash command implementation for serving the next truth question.
 *
 * @module src/commands/truth
 */

import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { getNextQuestion } from '../services/questionService.js';
import { buildQuestionEmbed, buildQuestionComponents } from '../utils/questionEmbeds.js';
import { questionRateLimiter } from '../utils/rateLimiter.js';
import logger from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('truth')
  .setDescription('Get the next truth question.');

/**
 * Handles execution of the `/truth` command by replying with the next truth prompt.
 *
 * @param interaction - Interaction payload from Discord.
 */
export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  // Check rate limit
  if (questionRateLimiter.isRateLimited(interaction.user.id)) {
    const timeUntilReset = questionRateLimiter.getTimeUntilReset(interaction.user.id);
    const secondsRemaining = Math.ceil(timeUntilReset / 1000);
    
    await interaction.reply({
      content: `You're requesting questions too quickly. Please wait ${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''} before trying again.`,
      flags: MessageFlags.Ephemeral,
    });
    
    logger.info('User rate limited on truth command', {
      userId: interaction.user.id,
      timeUntilReset,
    });
    return;
  }

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
