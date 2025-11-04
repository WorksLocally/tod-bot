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
 * This function implements the following flow:
 * 1. Checks rate limiting (max 20 questions per minute per user)
 * 2. Fetches the next truth question from the rotation queue
 * 3. Builds an embed with the question and requester information
 * 4. Adds interactive buttons (Truth, Dare, Submit Question)
 * 5. Replies to the interaction with the question
 *
 * Rate limiting prevents spam and abuse of the question system.
 * The rotation queue ensures fair distribution of all truth questions.
 *
 * @param interaction - Chat input command interaction from Discord.
 * @returns Promise that resolves when the reply is sent.
 *
 * @example
 * User executes: /truth
 * Bot replies with: An embed showing a truth question with interactive buttons
 */
export const execute = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  logger.debug('Truth command invoked', {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  });

  // Check rate limit
  if (questionRateLimiter.isRateLimited(interaction.user.id)) {
    const timeUntilReset = questionRateLimiter.getTimeUntilReset(interaction.user.id);
    const secondsRemaining = Math.ceil(timeUntilReset / 1000);

    await interaction.reply({
      content: `You're requesting questions too quickly. Please wait ${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''} before trying again.`,
      flags: MessageFlags.Ephemeral,
    });

    logger.warn('User rate limited on truth command', {
      userId: interaction.user.id,
      guildId: interaction.guildId,
      timeUntilReset,
      secondsRemaining,
    });
    return;
  }

  const question = getNextQuestion('truth');

  if (!question) {
    logger.warn('No truth questions available when requested', {
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    await interaction.reply({
      content: 'There are no truth questions available yet.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  logger.info('Truth question served', {
    questionId: question.question_id,
    userId: interaction.user.id,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
  });

  try {
    const embed = buildQuestionEmbed({
      question,
      requestedBy: (interaction.member as GuildMember | null) ?? interaction.user,
    });

    await interaction.reply({
      embeds: [embed],
      components: buildQuestionComponents(),
      allowedMentions: { parse: [] },
    });

    logger.debug('Truth question reply sent successfully', {
      questionId: question.question_id,
      userId: interaction.user.id,
    });
  } catch (error) {
    logger.error('Failed to send truth question reply', {
      error,
      questionId: question.question_id,
      userId: interaction.user.id,
      guildId: interaction.guildId,
    });
    throw error;
  }
};
