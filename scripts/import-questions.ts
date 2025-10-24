/**
 * Script to import questions from JSON files into the database.
 * This script imports questions from import-truth.json and import-dare.json
 * located in the project root directory.
 *
 * Usage: pnpm run import:questions
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { importQuestionsFromFile } from '../src/utils/importQuestions.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Main import function that processes both truth and dare JSON files.
 */
const runImport = async (): Promise<void> => {
  console.log('Starting question import process...\n');

  const files = [
    {
      name: 'Truth Questions',
      path: path.join(projectRoot, 'import-truth.json'),
    },
    {
      name: 'Dare Questions',
      path: path.join(projectRoot, 'import-dare.json'),
    },
  ];

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    console.log(`\n📥 Importing ${file.name} from ${file.path}...`);

    try {
      const result = importQuestionsFromFile(file.path);

      console.log(`✅ ${file.name} import completed:`);
      console.log(`   - Imported: ${result.imported}`);
      console.log(`   - Skipped:  ${result.skipped}`);
      console.log(`   - Errors:   ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.log('\n⚠️  Errors encountered:');
        result.errors.forEach((err) => {
          if (err.index >= 0) {
            console.log(`   - Index ${err.index}: ${err.error}`);
            if (err.question) {
              console.log(`     Question: ${err.question.substring(0, 60)}...`);
            }
          } else {
            console.log(`   - ${err.error}`);
          }
        });
      }

      totalImported += result.imported;
      totalSkipped += result.skipped;
      totalErrors += result.errors.length;
    } catch (error) {
      console.error(`❌ Failed to import ${file.name}:`, error);
      logger.error(`Failed to import ${file.name}`, { error });
      totalErrors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Imported: ${totalImported}`);
  console.log(`Total Skipped:  ${totalSkipped}`);
  console.log(`Total Errors:   ${totalErrors}`);
  console.log('='.repeat(60) + '\n');

  if (totalErrors > 0) {
    console.log('⚠️  Import completed with errors. Check logs for details.');
    process.exit(1);
  } else {
    console.log('✅ Import completed successfully!');
    process.exit(0);
  }
};

// Run the import
runImport().catch((error) => {
  console.error('Fatal error during import:', error);
  logger.error('Fatal error during import', { error });
  process.exit(1);
});
