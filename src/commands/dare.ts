/**
 * Slash command implementation for serving the next dare question.
 *
 * @module src/commands/dare
 */

import { SlashCommandBuilder, MessageFlags, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { getNextQuestion } from '../services/questionService.js';
import { buildQuestionEmbed, buildQuestionComponents } from '../utils/questionEmbeds.js';
import { questionRateLimiter } from '../utils/rateLimiter.js';
import logger from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('dare')
  .setDescription('Get the next dare question.');

/**
 * Handles execution of the `/dare` command by replying with the next dare prompt.
 *
 * This function implements the following flow:
 * 1. Checks rate limiting (max 20 questions per minute per user)
 * 2. Fetches the next dare question from the rotation queue
 * 3. Builds an embed with the question and requester information
 * 4. Adds interactive buttons (Truth, Dare, Submit Question)
 * 5. Replies to the interaction with the question
 *
 * Rate limiting prevents spam and abuse of the question system.
 * The rotation queue ensures fair distribution of all dare questions.
 *
 * @param interaction - Chat input command interaction from Discord.
 * @returns Promise that resolves when the reply is sent.
 *
 * @example
 * User executes: /dare
 * Bot replies with: An embed showing a dare question with interactive buttons
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
    
    logger.info('User rate limited on dare command', {
      userId: interaction.user.id,
      timeUntilReset,
    });
    return;
  }

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
    requestedBy: (interaction.member as GuildMember | null) ?? interaction.user,
  });

  await interaction.reply({
    embeds: [embed],
    components: buildQuestionComponents(),
    allowedMentions: { parse: [] },
  });
};
