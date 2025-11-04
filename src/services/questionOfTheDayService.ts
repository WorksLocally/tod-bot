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
 * Updates the QOTD state in the database to record the current posting time.
 *
 * This function uses SQLite's UPSERT (INSERT ... ON CONFLICT) to ensure
 * that only one state record exists (id=1) and is updated with each posting.
 *
 * @throws {Error} If database update fails.
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
 *
 * This function is typically called by the cron scheduler at 6pm UTC daily.
 * It performs the following operations:
 * 1. Validates that QOTD feature is enabled in configuration
 * 2. Validates that QOTD channel is configured
 * 3. Fetches the next truth question from the rotation queue
 * 4. Creates an embed with the question
 * 5. Posts to the configured channel
 * 6. Updates the QOTD state to record the posting time
 *
 * Only truth questions are posted for QOTD (not dare questions).
 * Uses the same rotation system as manual /truth commands.
 *
 * @param client - The Discord client instance for channel access.
 * @returns Promise that resolves when the question is posted successfully, or rejects with an Error if posting fails.
 * @throws {Error} If QOTD channel is not found or not a text channel. (The returned promise will be rejected with this error.)
 * @throws {Error} If posting to Discord fails. (The returned promise will be rejected with this error.)
 *
 * @example
 * ```typescript
 * // Called by cron scheduler
 * cron.schedule('0 18 * * *', async () => {
 *   await postQuestionOfTheDay(client);
 * });
 * ```
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
      .setFooter({ text: `Question ID: ${question.question_id} • Daily Questions are auto posted at 6pm UTC.` })
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
