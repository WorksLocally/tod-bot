/**
 * Service for detecting similar questions in the database.
 *
 * @module src/services/similarityService
 */

import { listQuestions } from './questionService.js';
import type { QuestionType } from './questionService.js';

export interface SimilarityMatch {
  questionId: string;
  text: string;
  similarityScore: number;
}

/**
 * Calculates the similarity between two strings using Levenshtein distance.
 * Returns a score between 0 and 1, where 1 is identical.
 *
 * @param str1 - First string to compare.
 * @param str2 - Second string to compare.
 * @returns Similarity score between 0 and 1.
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // Levenshtein distance calculation
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  // Convert distance to similarity score (0 to 1)
  return 1 - (distance / maxLength);
};

/**
 * Finds questions similar to the provided text.
 *
 * @param text - Question text to search for similarities.
 * @param type - Question type to filter by.
 * @param threshold - Minimum similarity score (0-1) to include in results. Default is 0.7 (70%).
 * @param limit - Maximum number of results to return. Default is 5.
 * @returns Array of similar questions sorted by similarity score (highest first).
 */
export const findSimilarQuestions = (
  text: string,
  type: QuestionType,
  threshold: number = 0.7,
  limit: number = 5
): SimilarityMatch[] => {
  const questions = listQuestions(type);
  const matches: SimilarityMatch[] = [];

  for (const question of questions) {
    const score = calculateSimilarity(text, question.text);
    
    if (score >= threshold) {
      matches.push({
        questionId: question.question_id,
        text: question.text,
        similarityScore: score,
      });
    }
  }

  // Sort by similarity score (highest first) and limit results
  matches.sort((a, b) => b.similarityScore - a.similarityScore);
  
  return matches.slice(0, limit);
};
