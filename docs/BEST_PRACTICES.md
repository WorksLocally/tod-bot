# Best Practices: TOD-Bot Coding Standards & Patterns

## Table of Contents
- [Code Organization](#code-organization)
- [TypeScript Best Practices](#typescript-best-practices)
- [Discord.js Patterns](#discordjs-patterns)
- [Database Patterns](#database-patterns)
- [Error Handling](#error-handling)
- [Security Practices](#security-practices)
- [Performance Optimization](#performance-optimization)
- [Testing Guidelines](#testing-guidelines)
- [Logging Standards](#logging-standards)
- [Code Review Checklist](#code-review-checklist)

---

## Code Organization

### Directory Structure Guidelines

**Follow the established layer pattern**:
```
src/
├── commands/          # Discord slash commands only
├── interactions/      # Button and modal handlers
│   ├── buttons/       # Button click handlers
│   └── modals/        # Modal submission handlers
├── services/          # Business logic (no Discord types)
├── database/          # Database client and schema
├── utils/             # Pure utilities (reusable)
└── config/            # Configuration management
```

**Naming Conventions**:
- **Commands**: Use verb-noun pattern (`submit.ts`, `question.ts`)
- **Handlers**: Describe the action (`approvalApprove.ts`, `questionNext.ts`)
- **Services**: Domain-based naming (`questionService.ts`, `approvalService.ts`)
- **Utilities**: Function-based naming (`sanitize.ts`, `rateLimiter.ts`)

### Module Organization Pattern

**Single Responsibility**: Each file should have ONE clear purpose

**Good Example**:
```typescript
// src/services/questionService.ts
// Purpose: Question CRUD operations and rotation logic

export function addQuestion(...) { }
export function editQuestion(...) { }
export function deleteQuestion(...) { }
export function getNextQuestion(...) { }
```

**Bad Example**:
```typescript
// src/services/botService.ts
// ❌ Too broad, mixes concerns

export function addQuestion(...) { }
export function approveSubmission(...) { }
export function sendMessage(...) { }
export function logEvent(...) { }
```

### File Size Guidelines

**Maximum Lines**: Keep files under 500 lines
- **Exception**: Main entry point (`index.ts`) can be longer
- **Solution**: Break large files into submodules (see `src/commands/question/`)

**When to Split**:
- File exceeds 500 lines
- Multiple distinct responsibilities
- Reusable components emerge

**Example**: Question command split into subcommands
```
src/commands/question.ts       # Router (100 lines)
src/commands/question/
  ├── add.ts                  # Add subcommand (150 lines)
  ├── delete.ts               # Delete subcommand (120 lines)
  ├── edit.ts                 # Edit subcommand (130 lines)
  ├── list.ts                 # List subcommand (200 lines)
  ├── view.ts                 # View subcommand (80 lines)
  └── shared.ts               # Shared utilities (100 lines)
```

---

## TypeScript Best Practices

### Type Safety

**Use Strict Mode** (already enabled in `tsconfig.json`):
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Avoid `any` Type**:
```typescript
// ❌ Bad
function processData(data: any) {
  return data.value;
}

// ✅ Good
function processData(data: { value: string }) {
  return data.value;
}

// ✅ Better - Use generics for flexibility
function processData<T extends { value: string }>(data: T) {
  return data.value;
}
```

**Use Type Guards**:
```typescript
// ✅ Good - Type narrowing
if (interaction.isChatInputCommand()) {
  // TypeScript knows interaction is ChatInputCommandInteraction
  const option = interaction.options.getString('text');
}

if (interaction.isButton()) {
  // TypeScript knows interaction is ButtonInteraction
  const customId = interaction.customId;
}
```

### Interface Design

**Prefer Interfaces for Objects**:
```typescript
// ✅ Good
interface BotConfig {
  discordToken: string;
  clientId: string;
  guildId: string;
  approvalChannelId: string;
  privilegedRoleIds: string[];
}

// ❌ Avoid type aliases for objects (less extensible)
type BotConfig = {
  discordToken: string;
  // ...
};
```

**Use Type Aliases for Unions/Primitives**:
```typescript
// ✅ Good
type QuestionType = 'truth' | 'dare';
type SubmissionStatus = 'pending' | 'approved' | 'rejected';
```

**Extend Existing Types**:
```typescript
// ✅ Good - Augment discord.js Client type
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
    buttonHandlers: ButtonHandler[];
  }
}
```

### Function Signatures

**Explicit Return Types**:
```typescript
// ✅ Good - Clear contract
function getNextQuestion(type: QuestionType): Question | null {
  // Implementation
}

// ❌ Avoid implicit returns (harder to maintain)
function getNextQuestion(type: QuestionType) {
  // TypeScript infers return type
}
```

**Use Optional Parameters Wisely**:
```typescript
// ✅ Good - Optional parameters last
function listQuestions(type?: QuestionType, limit: number = 100): Question[] {
  // Implementation
}

// ❌ Bad - Required after optional
function listQuestions(type?: QuestionType, limit: number): Question[] {
  // Compilation error
}
```

### Async/Await

**Prefer Async/Await Over Promises**:
```typescript
// ✅ Good
async function approveSubmission(submissionId: string) {
  const submission = await getSubmissionById(submissionId);
  await notifySubmitter(submission.userId);
  return submission;
}

// ❌ Avoid promise chains (harder to read)
function approveSubmission(submissionId: string) {
  return getSubmissionById(submissionId)
    .then(submission => notifySubmitter(submission.userId))
    .then(() => submission);
}
```

**Note**: Database operations with better-sqlite3 are synchronous (no async/await)

### Null Safety

**Use Nullish Coalescing**:
```typescript
// ✅ Good
const logLevel = config.logLevel ?? 'info';

// ❌ Avoid || for defaults (falsy values cause issues)
const logLevel = config.logLevel || 'info'; // Empty string would use default
```

**Optional Chaining**:
```typescript
// ✅ Good
const roleName = member?.roles?.cache?.first()?.name;

// ❌ Avoid manual null checks
const roleName = member && member.roles && member.roles.cache
  ? member.roles.cache.first()?.name
  : undefined;
```

---

## Discord.js Patterns

### Command Structure

**Standard Command Pattern**:
```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Client } from 'discord.js';
import type { BotConfig } from '../config/env.js';

export const data = new SlashCommandBuilder()
  .setName('commandname')
  .setDescription('Clear description of what this command does')
  .addStringOption(option =>
    option
      .setName('parameter')
      .setDescription('Parameter description')
      .setRequired(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client,
  config: BotConfig
): Promise<void> {
  // Implementation
}
```

**Key Principles**:
1. Export `data` and `execute`
2. Use `SlashCommandBuilder` for type safety
3. Include clear descriptions (visible to users)
4. Mark required options explicitly
5. Return `Promise<void>` from execute

### Interaction Handling

**Always Reply or Defer**:
```typescript
// ✅ Good - Immediate reply
await interaction.reply({
  content: 'Processing...',
  ephemeral: true
});

// ✅ Good - Defer for long operations
await interaction.deferReply({ ephemeral: true });
// ... perform operation ...
await interaction.editReply({ content: 'Done!' });

// ❌ Bad - No reply (interaction fails after 3 seconds)
// ... long operation without defer ...
await interaction.reply({ content: 'Done!' }); // Too late!
```

**Use Ephemeral for Errors and Private Info**:
```typescript
// ✅ Good - Errors are ephemeral
await interaction.reply({
  content: 'You do not have permission to use this command.',
  ephemeral: true
});

// ✅ Good - Public success messages
await interaction.reply({
  content: 'Question submitted for approval!',
  ephemeral: false // Visible to channel
});
```

**Update vs. Reply**:
```typescript
// ✅ Good - Update after defer
await interaction.deferReply();
await interaction.editReply({ content: 'Updated content' });

// ✅ Good - Update button interaction
await interaction.update({
  content: 'Updated content',
  components: []
});

// ❌ Bad - Cannot reply after update or vice versa
await interaction.update({ content: 'Updated' });
await interaction.reply({ content: 'Reply' }); // Error!
```

### Component Design

**Button Pattern**:
```typescript
// ✅ Good - Include context in customId
const button = new ButtonBuilder()
  .setCustomId(`action_type:${entityId}`)
  .setLabel('Action')
  .setStyle(ButtonStyle.Primary);

// Handler extracts context
const [action, type, entityId] = interaction.customId.split(/[_:]/);
```

**Action Row Limits**:
```typescript
// ✅ Good - Max 5 buttons per row, 5 rows per message
const row1 = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(button1, button2, button3, button4, button5);

const row2 = new ActionRowBuilder<ButtonBuilder>()
  .addComponents(button6, button7);

await interaction.reply({
  content: 'Choose an action',
  components: [row1, row2]
});
```

**Modal Pattern**:
```typescript
// ✅ Good - Modal with text input
const modal = new ModalBuilder()
  .setCustomId(`modal_action:${entityId}`)
  .setTitle('Modal Title');

const textInput = new TextInputBuilder()
  .setCustomId('field_name')
  .setLabel('Field Label')
  .setStyle(TextInputStyle.Paragraph)
  .setMaxLength(1000)
  .setRequired(true);

const row = new ActionRowBuilder<TextInputBuilder>()
  .addComponents(textInput);

modal.addComponents(row);
await interaction.showModal(modal);
```

### Embed Best Practices

**Use Embed Builder**:
```typescript
// ✅ Good - Structured embed
const embed = new EmbedBuilder()
  .setColor(0x0099ff)
  .setTitle('Title')
  .setDescription('Description')
  .addFields(
    { name: 'Field 1', value: 'Value 1', inline: true },
    { name: 'Field 2', value: 'Value 2', inline: true }
  )
  .setTimestamp()
  .setFooter({ text: 'Footer text' });
```

**Embed Limits**:
- Title: 256 characters
- Description: 4096 characters
- Field count: 25 fields
- Field name: 256 characters
- Field value: 1024 characters
- Footer: 2048 characters
- Total embed: 6000 characters

**Color Consistency**:
```typescript
// ✅ Good - Define color constants
const COLORS = {
  SUCCESS: 0x00ff00,
  ERROR: 0xff0000,
  INFO: 0x0099ff,
  WARNING: 0xffaa00
};

const embed = new EmbedBuilder()
  .setColor(COLORS.SUCCESS);
```

---

## Database Patterns

### Query Patterns

**Use Prepared Statements**:
```typescript
// ✅ Good - Parameterized query (prevents SQL injection)
const stmt = db.prepare('SELECT * FROM questions WHERE type = ?');
const questions = stmt.all(type);

// ❌ NEVER - String interpolation (SQL injection risk)
const questions = db.prepare(`SELECT * FROM questions WHERE type = '${type}'`).all();
```

**Cache Prepared Statements**:
```typescript
// ✅ Good - Reuse prepared statements
const stmtCache = new Map<string, Statement>();

function getOrPrepare(key: string, sql: string): Statement {
  if (!stmtCache.has(key)) {
    stmtCache.set(key, db.prepare(sql));
  }
  return stmtCache.get(key)!;
}

// Usage
const stmt = getOrPrepare('selectByType', 'SELECT * FROM questions WHERE type = ?');
const questions = stmt.all(type);
```

### Transaction Patterns

**Use Transactions for Atomic Operations**:
```typescript
// ✅ Good - Atomic multi-step operation
const addQuestionWithRotation = db.transaction((type: string, text: string) => {
  // Step 1: Insert question
  const insertStmt = db.prepare('INSERT INTO questions (type, text, position) VALUES (?, ?, ?)');
  const info = insertStmt.run(type, text, position);

  // Step 2: Update rotation state
  const updateStmt = db.prepare('UPDATE rotation_state SET last_position = ? WHERE type = ?');
  updateStmt.run(position, type);

  return info.lastInsertRowid;
});

// All steps succeed or all fail
const id = addQuestionWithRotation('truth', 'Question text');
```

**Transaction Best Practices**:
1. Keep transactions short (minimize lock time)
2. Avoid nested transactions (not supported)
3. Use for multi-statement operations
4. Handle errors to avoid leaving DB in inconsistent state

### Schema Migrations

**Add Migrations to `database/client.ts`**:
```typescript
// ✅ Good - Migration pattern
function applyMigrations(db: Database): void {
  // Check for migration marker
  const tableInfo = db.prepare("PRAGMA table_info('questions')").all();
  const hasNewColumn = tableInfo.some((col: any) => col.name === 'new_column');

  if (!hasNewColumn) {
    logger.info('Applying migration: add new_column to questions table');

    db.exec(`
      ALTER TABLE questions ADD COLUMN new_column TEXT;
    `);
  }
}
```

**Migration Principles**:
1. **Idempotent**: Safe to run multiple times
2. **Backwards Compatible**: Don't break existing code
3. **Logged**: Log migration application
4. **Automatic**: Run on startup (no manual intervention)

### Indexing Strategy

**Create Indexes for Common Queries**:
```typescript
// ✅ Good - Index on frequently queried columns
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_questions_type ON questions (type);
  CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_type_position
    ON questions (type, position);
`);
```

**When to Index**:
- Columns used in WHERE clauses
- Columns used in JOIN conditions
- Columns used in ORDER BY
- Foreign key columns

**When NOT to Index**:
- Small tables (< 1000 rows)
- Columns with low cardinality (few distinct values)
- Frequently updated columns (index maintenance overhead)

---

## Error Handling

### Error Handling Pattern

**Three-Layer Error Handling**:
```typescript
// Layer 1: Service Layer - Throw errors with context
export function getSubmissionById(submissionId: string): Submission {
  const submission = db.prepare('SELECT * FROM submissions WHERE submission_id = ?')
    .get(submissionId);

  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }

  return submission as Submission;
}

// Layer 2: Handler Layer - Catch and respond to user
export async function execute(
  interaction: ButtonInteraction,
  client: Client,
  config: BotConfig
): Promise<void> {
  try {
    const submissionId = extractId(interaction.customId);
    const submission = getSubmissionById(submissionId);
    // ... process submission ...
  } catch (error) {
    logger.error('Error handling approval', { error, customId: interaction.customId });

    await interaction.reply({
      content: 'An error occurred while processing your request.',
      ephemeral: true
    });
  }
}

// Layer 3: Global Error Handler - Catch unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  // Don't exit - PM2 will restart anyway
});
```

### Error Response Guidelines

**User-Facing Errors**:
```typescript
// ✅ Good - Clear, actionable error message
await interaction.reply({
  content: 'You must wait 5 minutes between submissions. Try again in 3 minutes.',
  ephemeral: true
});

// ❌ Bad - Technical jargon
await interaction.reply({
  content: 'RateLimitError: Token bucket exhausted',
  ephemeral: true
});
```

**Logging Errors**:
```typescript
// ✅ Good - Include context
logger.error('Failed to approve submission', {
  submissionId,
  userId: interaction.user.id,
  error: error instanceof Error ? {
    message: error.message,
    stack: error.stack,
    name: error.name
  } : error
});

// ❌ Bad - No context
logger.error('Error occurred', error);
```

### Validation Errors

**Validate Early, Fail Fast**:
```typescript
// ✅ Good - Validate at entry point
export async function execute(interaction: ChatInputCommandInteraction) {
  const text = interaction.options.getString('text', true);

  // Validate immediately
  if (text.length > 4000) {
    return interaction.reply({
      content: 'Question text must be 4000 characters or less.',
      ephemeral: true
    });
  }

  // Continue processing with valid data
}
```

---

## Security Practices

### Input Sanitization

**Always Sanitize User Input**:
```typescript
// ✅ Good - Sanitize before processing
import { sanitizeText } from '../utils/sanitize.js';

const text = interaction.options.getString('text', true);
const sanitized = sanitizeText(text, 4000);

// Use sanitized text in DB and responses
```

**Sanitization Functions**:
```typescript
// src/utils/sanitize.ts
export function sanitizeText(text: string, maxLength: number): string {
  // 1. Normalize line endings
  let sanitized = text.replace(/\r\n/g, '\n');

  // 2. Remove control characters (except newlines/tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');

  // 3. Trim whitespace
  sanitized = sanitized.trim();

  // 4. Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized;
}
```

### Permission Checking

**Always Check Permissions for Privileged Operations**:
```typescript
// ✅ Good - Check permissions first
import { hasPrivilegedRole } from '../utils/permissions.js';

if (!hasPrivilegedRole(interaction.member as GuildMember, config.privilegedRoleIds)) {
  return interaction.reply({
    content: 'You do not have permission to use this command.',
    ephemeral: true
  });
}

// Proceed with privileged operation
```

**Defensive Permission Checks**:
```typescript
// ✅ Good - Check in multiple places (defense in depth)

// 1. Command handler
if (!hasPrivilegedRole(member, config.privilegedRoleIds)) {
  return interaction.reply({ content: 'No permission', ephemeral: true });
}

// 2. Service function (defensive)
export function deleteQuestion(questionId: string, userId: string) {
  // Additional check in service layer
  if (!isAuthorized(userId)) {
    throw new Error('Unauthorized');
  }
  // Proceed with deletion
}
```

### Token Security

**Never Log or Expose Tokens**:
```typescript
// ✅ Good - Token only in environment variable
const token = config.discordToken;
client.login(token);

// ❌ NEVER - Log token
logger.info('Logging in with token', { token }); // SECURITY RISK!

// ❌ NEVER - Hardcode token
const token = 'MTA1OTk2MTc...'; // SECURITY RISK!
```

### Rate Limiting

**Apply Rate Limits to Public Commands**:
```typescript
// ✅ Good - Rate limit user actions
const rateLimiter = new RateLimiter(10, 5 * 60 * 1000); // 10 per 5 minutes

if (!rateLimiter.tryAcquire(interaction.user.id)) {
  const resetMs = rateLimiter.getTimeUntilReset(interaction.user.id);
  const resetMinutes = Math.ceil(resetMs / 60000);

  return interaction.reply({
    content: `You've submitted too many questions. Try again in ${resetMinutes} minutes.`,
    ephemeral: true
  });
}
```

### Secure ID Generation

**Use Cryptographically Secure Random IDs**:
```typescript
// ✅ Good - crypto.randomInt for IDs
import { randomInt } from 'crypto';

export function generateQuestionId(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';

  for (let i = 0; i < 8; i++) {
    const index = randomInt(0, characters.length);
    id += characters[index];
  }

  return id;
}

// ❌ Bad - Math.random (not cryptographically secure)
const index = Math.floor(Math.random() * characters.length);
```

---

## Performance Optimization

### Caching Guidelines

**Use LRU Cache for Frequently Accessed Data**:
```typescript
// ✅ Good - Cache frequently accessed questions
import { LRUCache } from '../utils/lruCache.js';

const questionCache = new LRUCache<string, Question>(100);

export function getQuestionById(questionId: string): Question | null {
  // Check cache first
  const cached = questionCache.get(questionId);
  if (cached) return cached;

  // Query database
  const question = db.prepare('SELECT * FROM questions WHERE question_id = ?')
    .get(questionId) as Question | undefined;

  // Cache result
  if (question) {
    questionCache.set(questionId, question);
  }

  return question || null;
}
```

**Cache Invalidation**:
```typescript
// ✅ Good - Invalidate on mutation
export function editQuestion(questionId: string, newText: string): void {
  // Update database
  db.prepare('UPDATE questions SET text = ?, updated_at = datetime("now") WHERE question_id = ?')
    .run(newText, questionId);

  // Invalidate cache
  questionCache.delete(questionId);
}
```

### Database Optimization

**Use Indexes for Common Queries**:
```typescript
// ✅ Good - Index on frequently queried columns
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_questions_type ON questions (type);
`);

// Query benefits from index
const questions = db.prepare('SELECT * FROM questions WHERE type = ?').all('truth');
```

**Avoid N+1 Queries**:
```typescript
// ❌ Bad - N+1 queries
const submissions = db.prepare('SELECT * FROM submissions').all();
for (const submission of submissions) {
  const user = await client.users.fetch(submission.user_id); // N queries
}

// ✅ Good - Batch fetch
const submissions = db.prepare('SELECT * FROM submissions').all();
const userIds = [...new Set(submissions.map(s => s.user_id))];
const users = await Promise.all(userIds.map(id => client.users.fetch(id))); // 1 batch
```

### Lazy Loading

**Load Modules Only When Needed**:
```typescript
// ✅ Good - Dynamic import for rarely used code
if (condition) {
  const { importQuestions } = await import('../utils/importQuestions.js');
  await importQuestions(filePath);
}

// ❌ Bad - Top-level import for rarely used code
import { importQuestions } from '../utils/importQuestions.js'; // Always loaded
```

### Minimize Discord API Calls

**Cache Discord Objects**:
```typescript
// ✅ Good - Cache channel reference
let cachedApprovalChannel: TextChannel | null = null;

async function getApprovalChannel(client: Client, channelId: string): Promise<TextChannel> {
  if (cachedApprovalChannel) return cachedApprovalChannel;

  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    throw new Error('Approval channel not found or not text-based');
  }

  cachedApprovalChannel = channel as TextChannel;
  return cachedApprovalChannel;
}
```

---

## Testing Guidelines

### Unit Testing

**Test Pure Functions**:
```typescript
// Example: Testing similarity service
import { calculateSimilarity } from '../services/similarityService.js';

describe('similarityService', () => {
  it('should return 1.0 for identical strings', () => {
    expect(calculateSimilarity('hello', 'hello')).toBe(1.0);
  });

  it('should return 0.0 for completely different strings', () => {
    expect(calculateSimilarity('hello', 'world')).toBeLessThan(0.3);
  });

  it('should handle case sensitivity', () => {
    expect(calculateSimilarity('Hello', 'hello')).toBeLessThan(1.0);
  });
});
```

**Test Utilities**:
```typescript
// Example: Testing sanitization
import { sanitizeText } from '../utils/sanitize.js';

describe('sanitize', () => {
  it('should remove control characters', () => {
    const input = 'Hello\x00World\x01';
    expect(sanitizeText(input, 100)).toBe('HelloWorld');
  });

  it('should trim whitespace', () => {
    expect(sanitizeText('  text  ', 100)).toBe('text');
  });

  it('should enforce max length', () => {
    const long = 'a'.repeat(1000);
    expect(sanitizeText(long, 100)).toHaveLength(100);
  });
});
```

### Integration Testing

**Test Database Operations**:
```typescript
// Example: Testing question service
import { addQuestion, getQuestionById } from '../services/questionService.js';

describe('questionService integration', () => {
  beforeEach(() => {
    // Setup test database
    db.exec('DELETE FROM questions');
  });

  it('should add and retrieve question', () => {
    const questionId = addQuestion('truth', 'Test question?', 'user123');
    const question = getQuestionById(questionId);

    expect(question).toBeDefined();
    expect(question.text).toBe('Test question?');
    expect(question.type).toBe('truth');
  });
});
```

### Manual Testing

**Test Checklist for New Commands**:
1. ✅ Command appears in Discord slash command list
2. ✅ Required parameters are enforced
3. ✅ Optional parameters have defaults
4. ✅ Permission checking works (test with unprivileged user)
5. ✅ Rate limiting works (spam command)
6. ✅ Error handling shows user-friendly messages
7. ✅ Ephemeral responses for errors
8. ✅ Public responses for success
9. ✅ Database changes persist
10. ✅ Logs show expected info/warn/error messages

---

## Logging Standards

### Log Levels

**Use Appropriate Log Levels**:
```typescript
// ✅ info - Normal operations
logger.info('Bot started successfully', { userId: client.user?.id });

// ✅ warn - Recoverable errors, missing data
logger.warn('User not found, skipping notification', { userId });

// ✅ error - Critical failures, exceptions
logger.error('Failed to update submission status', { submissionId, error });
```

### Log Messages

**Clear, Actionable Messages**:
```typescript
// ✅ Good - Descriptive message with context
logger.info('Posted submission for approval', {
  submissionId,
  userId,
  type,
  channelId
});

// ❌ Bad - Vague message
logger.info('Posted');
```

### Metadata Structure

**Include Relevant Context**:
```typescript
// ✅ Good - Structured metadata
logger.error('Failed to approve submission', {
  submissionId,
  userId: interaction.user.id,
  guildId: interaction.guildId,
  error: {
    message: error.message,
    stack: error.stack,
    name: error.name
  }
});

// ❌ Bad - Unstructured string
logger.error(`Failed to approve ${submissionId} for ${interaction.user.id}: ${error}`);
```

### Error Logging

**Sanitize Error Objects**:
```typescript
// ✅ Good - Extract relevant error fields
logger.error('Database error', {
  error: error instanceof Error ? {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: (error as any).code // For DB errors
  } : error
});

// ❌ Bad - Log entire error object (may have circular refs)
logger.error('Database error', { error });
```

---

## Code Review Checklist

### General

- [ ] Code follows TypeScript strict mode (no `any`, explicit types)
- [ ] File is in correct directory (`commands/`, `services/`, etc.)
- [ ] Naming conventions followed (camelCase, descriptive names)
- [ ] File size under 500 lines (or justified if larger)
- [ ] No commented-out code (remove or explain)
- [ ] No console.log statements (use logger)

### Discord.js Specifics

- [ ] Command has `data` and `execute` exports
- [ ] Command descriptions are clear and user-friendly
- [ ] Interactions always reply or defer (no hanging interactions)
- [ ] Ephemeral used for errors and private info
- [ ] Embeds respect Discord limits (title, description, fields)
- [ ] Components have clear customIds with context

### Database

- [ ] All queries use prepared statements (parameterized)
- [ ] No string interpolation in SQL
- [ ] Transactions used for multi-step operations
- [ ] Prepared statements cached for reuse
- [ ] Indexes exist for queried columns

### Security

- [ ] User input sanitized via `sanitizeText()`
- [ ] Permission checks for privileged operations
- [ ] Rate limiting applied to public commands
- [ ] No tokens or secrets in code or logs
- [ ] Cryptographically secure IDs (`crypto.randomInt`)

### Error Handling

- [ ] Try/catch blocks around async operations
- [ ] User-facing errors are clear and actionable
- [ ] Errors logged with context (metadata)
- [ ] Ephemeral error responses
- [ ] No stack traces exposed to users

### Performance

- [ ] Frequently accessed data cached (LRU cache)
- [ ] Cache invalidated on mutations
- [ ] Prepared statements cached
- [ ] Discord objects cached where possible
- [ ] No N+1 queries

### Logging

- [ ] Appropriate log level (info, warn, error)
- [ ] Clear, actionable log messages
- [ ] Structured metadata included
- [ ] Error objects sanitized (no circular refs)
- [ ] No sensitive data in logs (tokens, passwords)

### Testing

- [ ] Unit tests for pure functions
- [ ] Integration tests for database operations
- [ ] Manual testing checklist completed
- [ ] Edge cases considered (empty input, max length, etc.)

---

## Common Patterns

### Pattern: Permission-Gated Command

```typescript
export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client,
  config: BotConfig
): Promise<void> {
  // 1. Check permissions
  if (!hasPrivilegedRole(interaction.member as GuildMember, config.privilegedRoleIds)) {
    return interaction.reply({
      content: 'You do not have permission to use this command.',
      ephemeral: true
    });
  }

  // 2. Extract and validate input
  const questionId = interaction.options.getString('id', true);

  // 3. Execute business logic
  try {
    const question = getQuestionById(questionId);
    if (!question) {
      return interaction.reply({
        content: `Question not found: ${questionId}`,
        ephemeral: true
      });
    }

    // 4. Perform operation
    deleteQuestion(questionId);

    // 5. Respond to user
    await interaction.reply({
      content: `Question ${questionId} deleted successfully.`,
      ephemeral: false
    });

    // 6. Log event
    logger.info('Question deleted', {
      questionId,
      userId: interaction.user.id
    });

  } catch (error) {
    logger.error('Error deleting question', { questionId, error });

    await interaction.reply({
      content: 'An error occurred while deleting the question.',
      ephemeral: true
    });
  }
}
```

### Pattern: Paginated List

```typescript
export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client,
  config: BotConfig
): Promise<void> {
  // 1. Get data
  const questions = listQuestions();

  // 2. Paginate
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(questions.length / PAGE_SIZE);
  const page = 0;
  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageQuestions = questions.slice(start, end);

  // 3. Build embed
  const embed = new EmbedBuilder()
    .setTitle(`Questions (Page ${page + 1}/${totalPages})`)
    .setDescription(pageQuestions.map(q => `**${q.question_id}**: ${q.text}`).join('\n'));

  // 4. Add pagination buttons
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`list_prev:${page}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`list_next:${page}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1)
    );

  // 5. Reply
  await interaction.reply({
    embeds: [embed],
    components: [row]
  });
}
```

### Pattern: Modal Workflow

```typescript
// Step 1: Button shows modal
export async function execute(
  interaction: ButtonInteraction,
  client: Client,
  config: BotConfig
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('submit_modal')
    .setTitle('Submit Question');

  const textInput = new TextInputBuilder()
    .setCustomId('question_text')
    .setLabel('Your question')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(4000)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>()
    .addComponents(textInput);

  modal.addComponents(row);
  await interaction.showModal(modal);
}

// Step 2: Modal handler processes submission
export async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
  client: Client,
  config: BotConfig
): Promise<void> {
  const text = interaction.fields.getTextInputValue('question_text');
  const sanitized = sanitizeText(text, 4000);

  // Process submission
  await interaction.reply({
    content: 'Submission received!',
    ephemeral: true
  });
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern: God Objects

**❌ Bad**: Single service handling everything
```typescript
// botService.ts - TOO BROAD
export class BotService {
  addQuestion() { }
  deleteQuestion() { }
  approveSubmission() { }
  sendMessage() { }
  logEvent() { }
  // ... 50 more methods
}
```

**✅ Good**: Separate services by domain
```typescript
// questionService.ts
export function addQuestion() { }
export function deleteQuestion() { }

// submissionService.ts
export function createSubmission() { }
export function updateStatus() { }

// approvalService.ts
export function approveSubmission() { }
export function rejectSubmission() { }
```

### Anti-Pattern: Callback Hell

**❌ Bad**: Nested callbacks
```typescript
client.users.fetch(userId).then(user => {
  db.prepare('...').run(userId, (err) => {
    client.channels.fetch(channelId).then(channel => {
      // Deeply nested
    });
  });
});
```

**✅ Good**: Async/await
```typescript
const user = await client.users.fetch(userId);
db.prepare('...').run(userId); // Synchronous
const channel = await client.channels.fetch(channelId);
```

### Anti-Pattern: Silent Failures

**❌ Bad**: Swallowing errors
```typescript
try {
  deleteQuestion(questionId);
} catch (error) {
  // Silent failure - user never knows
}
```

**✅ Good**: Log and notify
```typescript
try {
  deleteQuestion(questionId);
} catch (error) {
  logger.error('Failed to delete question', { questionId, error });

  await interaction.reply({
    content: 'An error occurred while deleting the question.',
    ephemeral: true
  });
}
```

### Anti-Pattern: Mutable Global State

**❌ Bad**: Global variables that change
```typescript
// Global mutable state
let currentQuestion: Question | null = null;

export function setCurrentQuestion(q: Question) {
  currentQuestion = q; // Race conditions!
}
```

**✅ Good**: Stateless functions, DB state
```typescript
// State in database
export function getNextQuestion(type: QuestionType): Question | null {
  // Query database for rotation state
  return db.prepare('...').get(type);
}
```

---

## Summary

Following these best practices ensures:

- **Type Safety**: Full TypeScript coverage, no runtime type errors
- **Security**: Input validation, permission checks, no SQL injection
- **Performance**: Caching, indexed queries, minimal API calls
- **Maintainability**: Clear structure, consistent patterns, good logging
- **Reliability**: Error handling, defensive programming, transaction safety

**Key Takeaways**:
1. Use TypeScript strict mode religiously
2. Sanitize all user input
3. Cache prepared statements and frequently accessed data
4. Always reply to Discord interactions (reply or defer)
5. Use ephemeral responses for errors and private info
6. Log with context (structured metadata)
7. Follow the established layer pattern (commands → services → database)
8. Test edge cases and error paths

When in doubt, refer to existing code patterns in the codebase for consistency.
