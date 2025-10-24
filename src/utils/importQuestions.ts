/**
 * Utility for importing questions from JSON files into the database.
 * Questions are imported without requiring approval.
 *
 * @module src/utils/importQuestions
 */

import fs from 'fs';
import * as questionService from '../services/questionService.js';
import logger from './logger.js';

interface ImportQuestion {
  question: string;
  type: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ index: number; question: string; error: string }>;
}

/**
 * Validates that a question object has the required structure.
 *
 * @param obj - Object to validate.
 * @returns True if the object is a valid import question.
 */
const isValidImportQuestion = (obj: unknown): obj is ImportQuestion => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.question === 'string' &&
    candidate.question.trim().length > 0 &&
    typeof candidate.type === 'string' &&
    (candidate.type.toLowerCase() === 'truth' || candidate.type.toLowerCase() === 'dare')
  );
};

/**
 * Imports questions from a JSON file into the database.
 *
 * @param filePath - Path to the JSON file containing questions.
 * @returns Result summary with counts and any errors encountered.
 */
export const importQuestionsFromFile = (filePath: string): ImportResult => {
  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Read and parse the JSON file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!Array.isArray(data)) {
      throw new Error('JSON file must contain an array of questions');
    }

    logger.info(`Importing questions from ${filePath}`, { totalQuestions: data.length });

    // Process each question
    data.forEach((item, index) => {
      if (!isValidImportQuestion(item)) {
        result.skipped++;
        result.errors.push({
          index,
          question: JSON.stringify(item),
          error: 'Invalid question format (missing "question" or "type" field)',
        });
        return;
      }

      try {
        // Import the question using the existing service
        const imported = questionService.addQuestion({
          type: item.type,
          text: item.question,
          createdBy: 'IMPORT',
        });
        result.imported++;
        logger.debug(`Imported question: ${imported.question_id}`, {
          type: imported.type,
          text: item.question.substring(0, 50),
        });
      } catch (error) {
        result.skipped++;
        result.errors.push({
          index,
          question: item.question,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error(`Failed to import question at index ${index}`, { error });
      }
    });

    if (result.errors.length > 0) {
      result.success = false;
    }

    logger.info(`Import complete from ${filePath}`, {
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push({
      index: -1,
      question: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    logger.error(`Failed to read or parse file ${filePath}`, { error });
    return result;
  }
};
