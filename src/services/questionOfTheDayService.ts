/**
 * Service for managing Question of The Day (QOTD) functionality.
 * Handles posting scheduled daily questions alternating between truth and dare.
 *
 * @module src/services/questionOfTheDayService
 */

import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import db from '../database/client.js';
import { getNextQuestion } from './questionService.js';
import logger from '../utils/logger.js';
import config from '../config/env.js';

interface QotdState {
  lastPostedAt: string | null;
  lastPostedType: 'truth' | 'dare' | null;
}

/**
 * Retrieves the current QOTD state from the database.
 *
 * @returns The current QOTD state or null values if no state exists.
 */
const getQotdState = (): QotdState => {
  const stmt = db.prepare('SELECT last_posted_at, last_posted_type FROM qotd_state WHERE id = 1');
  const result = stmt.get() as { last_posted_at: string | null; last_posted_type: 'truth' | 'dare' | null } | undefined;

  if (!result) {
    return { lastPostedAt: null, lastPostedType: null };
  }

  return {
    lastPostedAt: result.last_posted_at,
    lastPostedType: result.last_posted_type,
  };
};

/**
 * Updates the QOTD state in the database.
 *
 * @param type - The type of question that was posted ('truth' or 'dare').
 */
const updateQotdState = (type: 'truth' | 'dare'): void => {
  const stmt = db.prepare(`
    INSERT INTO qotd_state (id, last_posted_at, last_posted_type)
    VALUES (1, datetime('now'), ?)
    ON CONFLICT(id) DO UPDATE SET
      last_posted_at = datetime('now'),
      last_posted_type = ?
  `);

  stmt.run(type, type);
};

/**
 * Determines which type of question should be posted next.
 * Alternates between 'truth' and 'dare'.
 *
 * @param lastType - The type of the last posted question, or null if none.
 * @returns The type of question to post next.
 */
const getNextQuestionType = (lastType: 'truth' | 'dare' | null): 'truth' | 'dare' => {
  if (lastType === null) {
    return 'truth'; // Start with truth if no previous post
  }
  return lastType === 'truth' ? 'dare' : 'truth';
};

/**
 * Posts the Question of The Day to the configured Discord channel.
 * Alternates between truth and dare questions.
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

    // Get the QOTD state
    const qotdState = getQotdState();
    const nextType = getNextQuestionType(qotdState.lastPostedType);

    // Get the next question
    const question = getNextQuestion(nextType);

    if (!question) {
      logger.warn(`No ${nextType} questions available for QOTD`);
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
      .setTitle(`Question of The Day - ${nextType.charAt(0).toUpperCase() + nextType.slice(1)}`)
      .setDescription(question.text)
      .setColor(nextType === 'truth' ? 0x3498db : 0xe74c3c) // Blue for truth, red for dare
      .setFooter({ text: `Question ID: ${question.question_id}` })
      .setTimestamp();

    // Post to channel
    await (channel as TextChannel).send({ embeds: [embed] });

    // Update the state
    updateQotdState(nextType);

    logger.info(`Posted QOTD: ${nextType} question ${question.question_id}`);
  } catch (error) {
    logger.error('Failed to post Question of The Day', { error });
    throw error;
  }
};
