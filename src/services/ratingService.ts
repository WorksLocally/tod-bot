/**
 * Service for managing question ratings (upvotes and downvotes).
 *
 * @module src/services/ratingService
 */

import db from '../database/client.js';
import logger from '../utils/logger.js';

/**
 * Adds or updates a rating for a question by a user.
 * If the user has already rated the question with the same rating, it removes the rating.
 * If the user has rated with a different rating, it updates to the new rating.
 *
 * @param questionId - The question ID.
 * @param userId - The user ID.
 * @param rating - The rating value (1 for upvote, -1 for downvote).
 * @returns The action performed: 'added', 'removed', or 'updated'.
 */
export const addOrUpdateRating = (
  questionId: string,
  userId: string,
  rating: 1 | -1
): 'added' | 'removed' | 'updated' => {
  try {
    const existingRating = db
      .prepare('SELECT rating FROM question_ratings WHERE question_id = ? AND user_id = ?')
      .get(questionId, userId) as { rating: number } | undefined;

    if (existingRating) {
      if (existingRating.rating === rating) {
        // Same rating - remove it (toggle off)
        db.prepare('DELETE FROM question_ratings WHERE question_id = ? AND user_id = ?').run(
          questionId,
          userId
        );
        logger.info('Removed question rating', { questionId, userId, rating });
        return 'removed';
      } else {
        // Different rating - update it
        db.prepare('UPDATE question_ratings SET rating = ?, created_at = datetime("now") WHERE question_id = ? AND user_id = ?').run(
          rating,
          questionId,
          userId
        );
        logger.info('Updated question rating', { questionId, userId, rating });
        return 'updated';
      }
    } else {
      // No existing rating - add it
      db.prepare('INSERT INTO question_ratings (question_id, user_id, rating) VALUES (?, ?, ?)').run(
        questionId,
        userId,
        rating
      );
      logger.info('Added question rating', { questionId, userId, rating });
      return 'added';
    }
  } catch (error) {
    logger.error('Error adding/updating rating', { error, questionId, userId, rating });
    throw error;
  }
};

/**
 * Gets the rating counts for a question.
 *
 * @param questionId - The question ID.
 * @returns An object containing upvote and downvote counts.
 */
export const getRatingCounts = (
  questionId: string
): { upvotes: number; downvotes: number } => {
  try {
    const result = db
      .prepare(`
        SELECT 
          SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as upvotes,
          SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END) as downvotes
        FROM question_ratings
        WHERE question_id = ?
      `)
      .get(questionId) as { upvotes: number | null; downvotes: number | null } | undefined;

    return {
      upvotes: result?.upvotes ?? 0,
      downvotes: result?.downvotes ?? 0,
    };
  } catch (error) {
    logger.error('Error getting rating counts', { error, questionId });
    return { upvotes: 0, downvotes: 0 };
  }
};

/**
 * Gets a user's rating for a question.
 *
 * @param questionId - The question ID.
 * @param userId - The user ID.
 * @returns The user's rating (1, -1, or null if not rated).
 */
export const getUserRating = (questionId: string, userId: string): 1 | -1 | null => {
  try {
    const result = db
      .prepare('SELECT rating FROM question_ratings WHERE question_id = ? AND user_id = ?')
      .get(questionId, userId) as { rating: number } | undefined;

    return result ? (result.rating as 1 | -1) : null;
  } catch (error) {
    logger.error('Error getting user rating', { error, questionId, userId });
    return null;
  }
};
