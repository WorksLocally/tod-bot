/**
 * In-memory cache for pending question submissions awaiting user confirmation.
 * Used to store submission data temporarily when similar questions are found.
 *
 * @module src/utils/pendingSubmissionCache
 */

import crypto from 'crypto';
import { LRUCache } from './lruCache.js';
import type { QuestionType } from '../services/questionService.js';

export interface PendingSubmission {
  type: QuestionType;
  text: string;
  userId: string;
  guildId?: string;
  timestamp: number;
}

// Cache for pending submissions (capacity: 100, TTL: 10 minutes)
const CACHE_CAPACITY = 100;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RETRY_ATTEMPTS = 10; // Maximum attempts to generate a unique ID

const pendingSubmissionCache = new LRUCache<string, PendingSubmission>(CACHE_CAPACITY);

/**
 * Generates a unique ID for a pending submission using cryptographically secure random values.
 *
 * @returns A unique 8-character alphanumeric ID.
 */
const generatePendingId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const charsLength = chars.length;
  let result = '';
  const maxRejectionAttempts = 100; // Safety limit for rejection sampling
  
  // Generate 8 characters using rejection sampling to avoid modulo bias
  for (let i = 0; i < 8; i++) {
    let randomValue: number;
    let attempts = 0;
    
    // Use rejection sampling to get unbiased random numbers
    do {
      if (attempts >= maxRejectionAttempts) {
        throw new Error('Failed to generate unbiased random value after maximum attempts');
      }
      randomValue = crypto.randomBytes(1)[0];
      attempts++;
    } while (randomValue >= 256 - (256 % charsLength)); // Reject values that would cause bias
    
    result += chars.charAt(randomValue % charsLength);
  }
  
  return result;
};

/**
 * Stores a pending submission and returns its unique ID.
 *
 * @param submission - The submission data to store.
 * @returns A unique ID that can be used to retrieve the submission.
 * @throws Error if unable to generate a unique ID after max retry attempts.
 */
export const storePendingSubmission = (submission: Omit<PendingSubmission, 'timestamp'>): string => {
  let pendingId: string;
  let attempts = 0;
  
  // Generate a unique ID with retry limit
  do {
    if (attempts >= MAX_RETRY_ATTEMPTS) {
      throw new Error('Failed to generate unique pending submission ID after maximum attempts');
    }
    
    pendingId = generatePendingId();
    attempts++;
  } while (pendingSubmissionCache.get(pendingId) !== undefined);
  
  const data: PendingSubmission = {
    ...submission,
    timestamp: Date.now(),
  };
  
  pendingSubmissionCache.set(pendingId, data);
  
  return pendingId;
};

/**
 * Retrieves and removes a pending submission by its ID.
 *
 * @param pendingId - The ID of the pending submission.
 * @returns The submission data if found and not expired, undefined otherwise.
 */
export const retrievePendingSubmission = (pendingId: string): PendingSubmission | undefined => {
  const data = pendingSubmissionCache.get(pendingId);
  
  if (!data) {
    return undefined;
  }
  
  // Check if expired
  if (Date.now() - data.timestamp > CACHE_TTL_MS) {
    pendingSubmissionCache.delete(pendingId);
    return undefined;
  }
  
  // Remove from cache after retrieval to prevent reuse
  pendingSubmissionCache.delete(pendingId);
  
  return data;
};
