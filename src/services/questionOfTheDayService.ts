/**
 * Service for managing Question of The Day (QOTD) functionality.
 * Handles posting scheduled daily truth questions.
 *
 * @module src/services/questionOfTheDayService
 */

import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import db from '../database/client.js';
import { getNextQuestion } from './questionService.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';

/**
 * Updates the QOTD state in the database.
 */
const updateQotdState = (): void => {
  const stmt = db.prepare(`
    INSERT INTO qotd_state (id, last_posted_at)
    VALUES (1, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      last_posted_at = datetime('now')
  `);

  stmt.run();
};

/**
 * Posts the Question of The Day to the configured Discord channel.
 * Posts truth questions only.
 *
 * @param client - The Discord client instance.
 * @returns Promise that resolves when the question is posted, or rejects on error.
 */
export const postQuestionOfTheDay = async (client: Client): Promise<void> => {
  try {
    // Check if QOTD is enabled
    if (!config.qotdEnabled) {
      logger.info('QOTD is disabled, skipping post');
      return;
    }

    // Check if channel is configured
    if (!config.qotdChannelId) {
      logger.warn('QOTD channel ID is not configured, skipping post');
      return;
    }

    // Always post truth questions
    const nextType = 'truth';

    // Get the next question
    const question = getNextQuestion(nextType);

    if (!question) {
      logger.warn(`No truth questions available for QOTD`);
      return;
    }

    // Get the channel
    const channel = await client.channels.fetch(config.qotdChannelId);

    if (!channel || !channel.isTextBased()) {
      logger.error(`QOTD channel ${config.qotdChannelId} not found or is not a text channel`);
      return;
    }

    // Create the embed
    const embed = new EmbedBuilder()
      .setTitle('Question of The Day')
      .setDescription(question.text)
      .setColor(0x3498db) // Blue for truth
      .setFooter({ text: `Question ID: ${question.question_id}` })
      .setTimestamp();

    // Update the state
    updateQotdState();

    // Post to channel
    await (channel as TextChannel).send({ embeds: [embed] });
    logger.info(`Posted QOTD: truth question ${question.question_id}`);
  } catch (error) {
    logger.error('Failed to post Question of The Day', { error });
    throw error;
  }
};
