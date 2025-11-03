# Troubleshooting Guide: TOD-Bot Known Issues & Solutions

## Table of Contents
- [Common Setup Issues](#common-setup-issues)
- [Discord API Issues](#discord-api-issues)
- [Database Issues](#database-issues)
- [Command Issues](#command-issues)
- [Permission Issues](#permission-issues)
- [Performance Issues](#performance-issues)
- [Deployment Issues](#deployment-issues)
- [Known Gotchas](#known-gotchas)
- [Debug Techniques](#debug-techniques)
- [FAQ](#faq)

---

## Common Setup Issues

### Issue: Bot Not Starting - "Invalid Token"

**Symptoms**:
```
Error: Used disallowed intents
or
Error: An invalid token was provided
```

**Causes**:
1. Invalid Discord bot token in `.env`
2. Token contains extra whitespace or quotes
3. Token regenerated in Discord Developer Portal but not updated locally

**Solutions**:
```bash
# 1. Check .env file
cat .env | grep DISCORD_TOKEN

# 2. Ensure no quotes around token
# ❌ Bad
DISCORD_TOKEN="MTA1OTk2MTc..."

# ✅ Good
DISCORD_TOKEN=MTA1OTk2MTc...

# 3. Regenerate token in Discord Developer Portal
# - Go to https://discord.com/developers/applications
# - Select your application
# - Bot → Reset Token
# - Copy new token to .env file (no quotes!)

# 4. Restart bot
pnpm start
```

**Prevention**:
- Use `.env.example` as template
- Never commit `.env` to version control
- Document token format in `.env.example`

---

### Issue: Slash Commands Not Appearing

**Symptoms**:
- Bot is online but commands don't show in Discord
- Typing `/truth` shows "No commands found"

**Causes**:
1. Commands not deployed to Discord
2. Wrong `GUILD_ID` in `.env`
3. Bot lacks `applications.commands` scope
4. Discord cache not refreshed

**Solutions**:
```bash
# 1. Deploy commands
pnpm run deploy:commands

# Expected output:
# Successfully registered X application commands

# 2. Verify GUILD_ID
# Get guild ID: Right-click server → Copy Server ID (enable Developer Mode first)
# Update .env:
GUILD_ID=your_actual_guild_id

# 3. Check bot invite URL includes proper scopes
# Required scopes:
# - bot
# - applications.commands

# Proper invite URL:
# https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=2048

# 4. Refresh Discord
# - Restart Discord client
# - Or wait up to 1 hour for cache to clear
```

**Prevention**:
- Run `deploy:commands` after every command structure change
- Document required bot scopes in README
- Use guild commands for development (instant updates)

---

### Issue: "Cannot find module" Errors

**Symptoms**:
```
Error: Cannot find module '../services/questionService.js'
```

**Causes**:
1. Missing `.js` extension in import (required for ES modules)
2. TypeScript not compiled to JavaScript
3. Incorrect relative path

**Solutions**:
```typescript
// ❌ Bad - Missing .js extension
import { getNextQuestion } from '../services/questionService';

// ✅ Good - Include .js extension (even for .ts files!)
import { getNextQuestion } from '../services/questionService.js';

// Compile TypeScript
pnpm build

// Verify output exists
ls -la dist/src/services/questionService.js
```

**Why `.js` Extension?**
- TypeScript uses ES modules (`"module": "NodeNext"`)
- ES modules require explicit file extensions
- TypeScript doesn't rewrite import paths during compilation
- Even though source is `.ts`, import must use `.js`

**Prevention**:
- Always use `.js` extension in imports
- Run ESLint to catch missing extensions
- Configure IDE to auto-add extensions

---

### Issue: Database File Locked

**Symptoms**:
```
Error: SQLITE_BUSY: database is locked
```

**Causes**:
1. Multiple bot instances accessing same database
2. Long-running transaction blocking writes
3. File permissions issue

**Solutions**:
```bash
# 1. Check for multiple bot processes
ps aux | grep node
# Kill duplicate processes
kill -9 <PID>

# 2. Check WAL mode (should be enabled)
sqlite3 data/todbot.db "PRAGMA journal_mode;"
# Expected output: wal

# 3. Enable WAL mode if not set
sqlite3 data/todbot.db "PRAGMA journal_mode=WAL;"

# 4. Check file permissions
ls -la data/todbot.db
# Should be writable by bot process user

# 5. Fix permissions if needed
chmod 644 data/todbot.db
```

**Prevention**:
- Use PM2 to manage single instance
- Enable WAL mode in database initialization
- Keep transactions short

---

## Discord API Issues

### Issue: "Interaction has already been acknowledged"

**Symptoms**:
```
DiscordAPIError: Interaction has already been acknowledged
```

**Causes**:
1. Called both `interaction.reply()` and `interaction.deferReply()`
2. Called `interaction.reply()` multiple times
3. Called `interaction.update()` then `interaction.reply()`

**Solutions**:
```typescript
// ❌ Bad - Multiple replies
await interaction.deferReply();
await interaction.reply({ content: 'Done' }); // Error!

// ✅ Good - Defer then edit
await interaction.deferReply();
await interaction.editReply({ content: 'Done' });

// ❌ Bad - Update then reply
await interaction.update({ content: 'Updated' });
await interaction.reply({ content: 'Done' }); // Error!

// ✅ Good - Update OR reply (not both)
await interaction.update({ content: 'Done' });

// ✅ Good - Reply immediately if fast operation
await interaction.reply({ content: 'Done' });
```

**Rule of Thumb**:
- **Fast operations** (< 3 seconds): Use `interaction.reply()`
- **Slow operations** (> 3 seconds): Use `interaction.deferReply()` then `interaction.editReply()`
- **Button updates**: Use `interaction.update()` to modify existing message

**Prevention**:
- Choose reply OR defer + edit (never both)
- Use update for button interactions
- Set timeout of 2.5 seconds for defer decision

---

### Issue: "Unknown Interaction" Error

**Symptoms**:
```
DiscordAPIError: Unknown interaction
```

**Causes**:
1. Took longer than 3 seconds to respond to interaction
2. Forgot to defer long-running operations
3. Bot restarted and lost interaction context

**Solutions**:
```typescript
// ✅ Good - Defer immediately for long operations
export async function execute(interaction: ChatInputCommandInteraction) {
  // Defer within 3 seconds
  await interaction.deferReply({ ephemeral: true });

  // Long operation
  const questions = await fetchManyQuestions();
  const processed = await processQuestions(questions);

  // Edit reply after operation completes
  await interaction.editReply({ content: 'Done!' });
}

// ✅ Good - Fast path for quick operations
export async function execute(interaction: ChatInputCommandInteraction) {
  const question = getNextQuestion('truth'); // Fast DB query

  await interaction.reply({
    content: question.text,
    ephemeral: false
  });
}
```

**Prevention**:
- Defer within 2 seconds for any operation that might be slow
- Use loading indicators during defer
- Test with slow network conditions

---

### Issue: Rate Limited by Discord

**Symptoms**:
```
DiscordAPIError: You are being rate limited
```

**Causes**:
1. Sending too many messages too quickly
2. Fetching same user/channel repeatedly
3. Global rate limit exceeded (50 requests/second)

**Solutions**:
```typescript
// ❌ Bad - Repeated fetches
for (const submission of submissions) {
  const user = await client.users.fetch(submission.user_id); // Rate limited!
}

// ✅ Good - Cache fetched users
const userCache = new Map<string, User>();

async function getUser(userId: string): Promise<User> {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  const user = await client.users.fetch(userId);
  userCache.set(userId, user);
  return user;
}

// ✅ Good - Batch fetch
const uniqueUserIds = [...new Set(submissions.map(s => s.user_id))];
const users = await Promise.all(uniqueUserIds.map(id => client.users.fetch(id)));
```

**Discord Rate Limits**:
- **Global**: 50 requests/second across all routes
- **Per-route**: Varies (e.g., 5 messages/5 seconds per channel)
- **Handled automatically** by discord.js (requests queued)

**Prevention**:
- Cache Discord objects (users, channels, roles)
- Batch fetch when possible
- Use LRU cache for frequently accessed objects

---

### Issue: Missing Permissions

**Symptoms**:
```
DiscordAPIError: Missing Permissions
or
DiscordAPIError: Missing Access
```

**Causes**:
1. Bot lacks required permissions in guild
2. Bot lacks permissions in specific channel
3. Bot role positioned below target role

**Solutions**:
```bash
# 1. Check bot permissions in server settings
# Required permissions:
# - Send Messages
# - Embed Links
# - Use Slash Commands
# - Read Message History (for button interactions)

# 2. Check channel-specific permissions
# - Ensure bot can access approval channel
# - Verify bot can send DMs (server members must allow DMs)

# 3. Check role hierarchy
# - Bot's role must be above roles it needs to manage
# - Administrator permission bypasses hierarchy

# 4. Re-invite bot with correct permissions
# Use invite URL with permissions integer
# Example: permissions=2048 (Send Messages)
```

**Permission Integer Calculator**:
- https://discord.com/developers/applications → Bot → URL Generator
- Select required permissions → Copy URL

**Prevention**:
- Document required permissions in README
- Check permissions before operations
- Use Administrator permission for simplicity (if acceptable)

---

## Database Issues

### Issue: Database Schema Mismatch

**Symptoms**:
```
Error: no such column: questions.position
or
Error: UNIQUE constraint failed: questions.type, questions.position
```

**Causes**:
1. Database created before migration was added
2. Manual database modification
3. Migration not applied

**Solutions**:
```bash
# Option 1: Delete and recreate database (DESTROYS DATA!)
rm data/todbot.db
pnpm start
# Database will be recreated with latest schema

# Option 2: Manually apply migration
sqlite3 data/todbot.db

# Check current schema
.schema questions

# Apply missing migration (example)
ALTER TABLE questions ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

# Verify schema
.schema questions
.exit

# Restart bot
pnpm start
```

**Prevention**:
- Run migrations automatically on startup (see `database/client.ts`)
- Version database schema
- Backup database before manual changes

---

### Issue: Position Uniqueness Violation

**Symptoms**:
```
Error: UNIQUE constraint failed: questions.type, questions.position
```

**Causes**:
1. Concurrent question additions
2. Position not recalculated after deletion
3. Manual database modification

**Solutions**:
```bash
# Fix position values in database
sqlite3 data/todbot.db

# Recalculate positions for truth questions
WITH numbered AS (
  SELECT question_id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS new_pos
  FROM questions
  WHERE type = 'truth'
)
UPDATE questions
SET position = (SELECT new_pos FROM numbered WHERE numbered.question_id = questions.question_id)
WHERE type = 'truth';

# Repeat for dare questions
WITH numbered AS (
  SELECT question_id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 AS new_pos
  FROM questions
  WHERE type = 'dare'
)
UPDATE questions
SET position = (SELECT new_pos FROM numbered WHERE numbered.question_id = questions.question_id)
WHERE type = 'dare';

.exit

# Restart bot
pnpm start
```

**Prevention**:
- Use transactions for position updates
- Implement position recalculation on delete
- Add migration to fix existing positions

---

### Issue: "Database is readonly"

**Symptoms**:
```
Error: attempt to write a readonly database
```

**Causes**:
1. Database file is read-only
2. Data directory is read-only
3. Running as user without write permissions

**Solutions**:
```bash
# 1. Check file permissions
ls -la data/todbot.db

# 2. Make writable
chmod 644 data/todbot.db

# 3. Check directory permissions
ls -la data/

# 4. Make directory writable
chmod 755 data/

# 5. Check ownership
# Ensure bot process user owns files
chown bot_user:bot_user data/todbot.db
```

**Prevention**:
- Create data directory with correct permissions during setup
- Document required permissions in README
- Run bot as user with appropriate permissions (not root)

---

## Command Issues

### Issue: Command Options Not Showing

**Symptoms**:
- Command appears but no autocomplete for options
- Required options not enforced

**Causes**:
1. Command deployed with old structure
2. Options not marked as required
3. Choices not defined properly

**Solutions**:
```typescript
// ✅ Good - Explicit required option
export const data = new SlashCommandBuilder()
  .setName('submit')
  .setDescription('Submit a question')
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Question type')
      .setRequired(true) // Enforced by Discord
      .addChoices(
        { name: 'Truth', value: 'truth' },
        { name: 'Dare', value: 'dare' }
      )
  );

// Re-deploy commands after changes
pnpm run deploy:commands
```

**Prevention**:
- Always re-deploy commands after structure changes
- Test commands in Discord after deployment
- Use TypeScript for compile-time checks

---

### Issue: Subcommands Not Working

**Symptoms**:
```
Error: Cannot add both subcommands and options to a command
```

**Causes**:
1. Mixed subcommands and options on same command
2. Subcommand structure incorrect

**Solutions**:
```typescript
// ❌ Bad - Mixed subcommands and options
export const data = new SlashCommandBuilder()
  .setName('question')
  .addStringOption(...) // Can't have options AND subcommands
  .addSubcommand(...);

// ✅ Good - Subcommands only
export const data = new SlashCommandBuilder()
  .setName('question')
  .setDescription('Manage questions')
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('Add a question')
      .addStringOption(option => ...) // Options go on subcommand
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('Delete a question')
      .addStringOption(option => ...)
  );
```

**Rule**: Commands can have **either** subcommands **or** options, **not both**

**Prevention**:
- Use subcommands for multi-action commands
- Put options on subcommands, not parent command
- Review Discord.js documentation for command structure

---

## Permission Issues

### Issue: Moderator Commands Not Working

**Symptoms**:
- Moderators see "You do not have permission to use this command"
- Only server administrators can use commands

**Causes**:
1. Role IDs not configured in `.env`
2. Wrong role IDs copied
3. Role deleted/renamed in Discord

**Solutions**:
```bash
# 1. Get role IDs from Discord
# Enable Developer Mode: Settings → Advanced → Developer Mode
# Right-click role → Copy Role ID

# 2. Update .env
ADMIN_ROLE_ID=123456789012345678
MODERATOR_ROLE_ID=234567890123456789
QUESTION_MASTER_ROLE_ID=345678901234567890

# At least one role ID required for moderator features

# 3. Verify role IDs in Discord
# Server Settings → Roles → Copy ID

# 4. Restart bot
pnpm start
```

**Testing**:
```typescript
// Test permission check
import { hasPrivilegedRole } from './utils/permissions.js';

const member = await guild.members.fetch(userId);
const hasPermission = hasPrivilegedRole(member, config.privilegedRoleIds);
console.log('Has permission:', hasPermission);
```

**Prevention**:
- Document role setup in README
- Log permission checks for debugging
- Test with non-admin users

---

### Issue: Bot Can't Send DMs

**Symptoms**:
```
DiscordAPIError: Cannot send messages to this user
```

**Causes**:
1. User has DMs disabled from server members
2. User blocked the bot
3. User not in mutual server

**Solutions**:
```typescript
// ✅ Good - Handle DM failures gracefully
async function notifySubmitter(userId: string, message: string) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(message);
    logger.info('Notification sent', { userId });
  } catch (error) {
    logger.warn('Failed to send DM (user may have DMs disabled)', {
      userId,
      error: error instanceof Error ? error.message : error
    });

    // Fallback: Log or store notification for later
    // Don't throw error (submission still approved)
  }
}
```

**User Instructions**:
- Enable DMs: Server → Privacy Settings → Allow DMs from server members
- Unblock bot if accidentally blocked

**Prevention**:
- Always handle DM failures gracefully
- Provide alternative notification methods
- Document DM requirements for users

---

## Performance Issues

### Issue: Slow Question Retrieval

**Symptoms**:
- `/truth` and `/dare` commands take > 1 second to respond
- Database query timeouts

**Causes**:
1. Missing index on `type` column
2. Large number of questions (> 10,000)
3. Database file on slow storage

**Solutions**:
```bash
# 1. Check for indexes
sqlite3 data/todbot.db
.indexes questions
# Expected: idx_questions_type, idx_questions_type_position

# 2. Create missing indexes
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions (type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_type_position
  ON questions (type, position);

# 3. Analyze query performance
EXPLAIN QUERY PLAN SELECT * FROM questions WHERE type = 'truth';
# Should show "USING INDEX idx_questions_type"

# 4. Vacuum database (optimize)
VACUUM;
.exit

# 5. Move database to faster storage (SSD)
```

**Prevention**:
- Create indexes during schema initialization
- Monitor query performance in logs
- Use prepared statement caching (already implemented)

---

### Issue: Memory Usage Growing

**Symptoms**:
- Bot memory usage increases over time
- PM2 restarts bot due to memory limit
- Node.js out of memory errors

**Causes**:
1. Cache not evicting old entries
2. Memory leak in event listeners
3. Large log files not rotated

**Solutions**:
```bash
# 1. Check memory usage
pm2 monit

# 2. Check cache sizes
# LRU caches should auto-evict (capacity: 100)
# If not, check LRUCache implementation

# 3. Check log rotation
ls -lh logs/
# Should see dated files and .gz archives

# 4. Increase memory limit (if justified)
# Edit ecosystem.config.json
"max_memory_restart": "2G" # Increase from 1G

# 5. Restart bot
pm2 restart tod-bot
```

**Debug Memory Leaks**:
```typescript
// Add to index.ts for debugging
setInterval(() => {
  const usage = process.memoryUsage();
  logger.info('Memory usage', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`
  });
}, 60000); // Log every minute
```

**Prevention**:
- Use LRU cache with capacity limits (already implemented)
- Remove event listeners when no longer needed
- Monitor memory usage with PM2
- Set memory restart threshold

---

## Deployment Issues

### Issue: PM2 Not Starting Bot

**Symptoms**:
```
pm2 start ecosystem.config.json
Error: Script not found: ./dist/src/index.js
```

**Causes**:
1. TypeScript not compiled
2. Wrong script path in `ecosystem.config.json`
3. `dist/` directory deleted

**Solutions**:
```bash
# 1. Compile TypeScript
pnpm build

# 2. Verify output exists
ls -la dist/src/index.js

# 3. Start bot
pm2 start ecosystem.config.json

# 4. Check logs
pm2 logs tod-bot
```

**Prevention**:
- Include build step in deployment script
- Don't delete `dist/` manually
- Commit `ecosystem.config.json` to version control

---

### Issue: Environment Variables Not Loaded

**Symptoms**:
- PM2 shows bot running but crashes immediately
- Logs show "Missing required environment variable"

**Causes**:
1. `.env` file not in correct location
2. PM2 working directory incorrect
3. Environment variables not exported to PM2

**Solutions**:
```bash
# 1. Verify .env location
ls -la .env
# Should be in project root

# 2. Check PM2 working directory
pm2 info tod-bot
# "cwd" should be project root

# 3. Restart PM2 daemon
pm2 kill
pm2 start ecosystem.config.json

# 4. Alternative: Use PM2 env config
# Edit ecosystem.config.json
{
  "env": {
    "DISCORD_TOKEN": "your_token_here",
    "CLIENT_ID": "your_client_id"
    // ... other vars
  }
}

# NOT RECOMMENDED - Prefer .env file for secrets
```

**Prevention**:
- Keep `.env` in project root
- Don't rely on shell environment variables
- Document `.env` location in README

---

### Issue: Bot Crashes on Startup

**Symptoms**:
```
pm2 logs tod-bot
Error: ENOENT: no such file or directory, open 'data/todbot.db'
```

**Causes**:
1. `data/` directory doesn't exist
2. Wrong `DATABASE_PATH` in `.env`
3. File permissions issue

**Solutions**:
```bash
# 1. Create data directory
mkdir -p data

# 2. Verify DATABASE_PATH
cat .env | grep DATABASE_PATH
# Should be: DATABASE_PATH=./data/todbot.db

# 3. Set permissions
chmod 755 data

# 4. Restart bot
pm2 restart tod-bot

# 5. Verify database created
ls -la data/todbot.db
```

**Prevention**:
- Create `data/` directory in setup script
- Add `data/` to `.gitkeep` (but not contents)
- Document directory structure in README

---

## Known Gotchas

### Gotcha 1: ES Module Import Extensions

**Issue**: TypeScript source uses `.ts` but imports must use `.js`

**Why**: TypeScript doesn't rewrite import paths for ES modules

**Solution**:
```typescript
// ❌ Wrong
import { foo } from './module'; // Missing extension
import { bar } from './module.ts'; // Wrong extension

// ✅ Correct
import { foo } from './module.js'; // Use .js even for .ts files
```

**Automated Check**:
```bash
# ESLint rule to enforce
# (Add to eslint.config.mjs if not present)
rules: {
  'import/extensions': ['error', 'always', { ignorePackages: true }]
}
```

---

### Gotcha 2: SQLite Synchronous Operations

**Issue**: `better-sqlite3` operations are synchronous, not async

**Why**: SQLite is embedded database, synchronous API for simplicity

**Solution**:
```typescript
// ❌ Wrong - No await needed
const questions = await db.prepare('SELECT * FROM questions').all();

// ✅ Correct - Synchronous call
const questions = db.prepare('SELECT * FROM questions').all();

// For Discord operations (async)
await interaction.reply({ content: 'Done' }); // Needs await
```

**Rule**: Database operations are sync, Discord operations are async

---

### Gotcha 3: Button Custom ID Length Limit

**Issue**: Button `customId` max length is 100 characters

**Why**: Discord API limitation

**Solution**:
```typescript
// ❌ Bad - May exceed 100 chars
const customId = `approval_approve:${submissionId}:${userId}:${timestamp}:${extra_data}`;

// ✅ Good - Keep IDs short
const customId = `approval_approve:${submissionId}`;

// Fetch additional context from database using submissionId
```

**Prevention**:
- Store context in database, not in custom ID
- Use short alphanumeric IDs (6-8 chars)
- Validate custom ID length before creating button

---

### Gotcha 4: Ephemeral Messages Can't Be Updated by Others

**Issue**: Ephemeral messages can only be seen and updated by the user who triggered them

**Why**: Discord design (private messages)

**Solution**:
```typescript
// ❌ Bad - Ephemeral message with button for others
await interaction.reply({
  content: 'Click to approve',
  components: [approveButton],
  ephemeral: true // Others can't see or click button!
});

// ✅ Good - Public message for shared buttons
await interaction.reply({
  content: 'Click to approve',
  components: [approveButton],
  ephemeral: false // Everyone can see and interact
});

// ✅ Good - Ephemeral for errors and confirmations
await interaction.reply({
  content: 'Submission received! Moderators will review.',
  ephemeral: true // Only user sees this
});
```

**Rule**: Use ephemeral for errors and private info, public for shared interactions

---

### Gotcha 5: Discord Cache May Be Stale

**Issue**: `client.channels.cache` and `client.users.cache` may not have latest data

**Why**: Discord.js caches objects, but cache may be empty or outdated

**Solution**:
```typescript
// ❌ Bad - Assumes cache is populated
const channel = client.channels.cache.get(channelId);
// May be undefined even if channel exists!

// ✅ Good - Fetch to ensure latest data
const channel = await client.channels.fetch(channelId);

// ✅ Better - Cache fetched objects
let cachedChannel: TextChannel | null = null;

async function getChannel(id: string): Promise<TextChannel> {
  if (!cachedChannel) {
    cachedChannel = await client.channels.fetch(id) as TextChannel;
  }
  return cachedChannel;
}
```

**Rule**: Use `fetch()` for critical operations, cache for performance

---

### Gotcha 6: Rate Limiter Cleanup Memory Leak

**Issue**: Rate limiter map grows unbounded without cleanup

**Why**: Expired entries never removed, users accumulate over time

**Solution**:
```typescript
// ✅ Good - Cleanup interval (see rateLimiter.ts)
setInterval(() => {
  const now = Date.now();
  for (const [userId, windows] of this.requests.entries()) {
    // Remove windows older than time window
    const validWindows = windows.filter(time => now - time < this.timeWindowMs);
    if (validWindows.length === 0) {
      this.requests.delete(userId);
    } else {
      this.requests.set(userId, validWindows);
    }
  }
}, this.timeWindowMs); // Run every time window
```

**Already implemented** in `src/utils/rateLimiter.ts`, but good to know

---

### Gotcha 7: Prepared Statement Must Be Reused

**Issue**: Creating prepared statements in tight loops is slow

**Why**: SQL parsing overhead on each creation

**Solution**:
```typescript
// ❌ Bad - Prepare in loop
for (const type of types) {
  const stmt = db.prepare('SELECT * FROM questions WHERE type = ?');
  const questions = stmt.all(type); // Prepare overhead repeated!
}

// ✅ Good - Prepare once, reuse
const stmt = db.prepare('SELECT * FROM questions WHERE type = ?');
for (const type of types) {
  const questions = stmt.all(type); // Fast!
}

// ✅ Better - Cache prepared statements (see questionService.ts)
const stmtCache = new Map<string, Statement>();
```

**Already implemented** in services, but good practice to remember

---

## Debug Techniques

### Technique 1: Enable Debug Logging

**Temporary Debug Logs**:
```typescript
// Add to any function for debugging
logger.info('DEBUG: Function called', {
  parameter1: value1,
  parameter2: value2
});

// Or use console.log for immediate output (remove before commit!)
console.log('DEBUG:', { customId: interaction.customId, userId: interaction.user.id });
```

**Change Log Level**:
```bash
# Edit .env
LOG_LEVEL=debug

# Restart bot
pm2 restart tod-bot

# Or set for single run
LOG_LEVEL=debug pnpm dev
```

---

### Technique 2: Inspect Database State

**SQLite Command Line**:
```bash
# Open database
sqlite3 data/todbot.db

# Check schema
.schema questions

# Count records
SELECT COUNT(*) FROM questions;

# View recent submissions
SELECT * FROM submissions ORDER BY created_at DESC LIMIT 10;

# Check rotation state
SELECT * FROM rotation_state;

# Exit
.exit
```

**Export Data**:
```bash
# Export to CSV
sqlite3 data/todbot.db
.mode csv
.output questions.csv
SELECT * FROM questions;
.exit
```

---

### Technique 3: Test Interactions Locally

**Simulate Button Click**:
```typescript
// Create test interaction object
const testInteraction = {
  customId: 'approval_approve:ABC123',
  user: { id: '123456789' },
  reply: async (options: any) => console.log('Reply:', options),
  update: async (options: any) => console.log('Update:', options)
};

// Call handler
await handler.execute(testInteraction as any, client, config);
```

**Use Discord Developer Mode**:
- Settings → Advanced → Developer Mode
- Right-click anything to copy IDs (users, channels, messages, roles)
- Essential for debugging

---

### Technique 4: Monitor PM2 Logs

**Real-time Logs**:
```bash
# Follow logs
pm2 logs tod-bot --lines 100

# Filter errors only
pm2 logs tod-bot --err

# Clear logs
pm2 flush
```

**Log Files**:
```bash
# Application logs
tail -f logs/tod-bot-2025-11-03.log

# PM2 logs
tail -f ~/.pm2/logs/tod-bot-out.log
tail -f ~/.pm2/logs/tod-bot-error.log
```

---

### Technique 5: Check Discord API Status

**Discord API Issues**:
- Check https://discordstatus.com
- If Discord is down, bot commands will fail
- No fix on your end, wait for Discord to resolve

**Verify Bot Status**:
```bash
# Check bot online in Discord
# Green dot = online
# Gray dot = offline

# Check PM2 status
pm2 status

# Check logs for connection errors
pm2 logs tod-bot | grep -i "error"
```

---

## FAQ

### Q: How do I add a new question type?

**A**: Current implementation hardcodes 'truth' and 'dare' types

**Steps to Add New Type**:
1. Update type definition in database schema (CHECK constraint)
2. Update TypeScript type: `type QuestionType = 'truth' | 'dare' | 'newtype'`
3. Add new command file: `src/commands/newtype.ts`
4. Initialize rotation state for new type in database
5. Deploy commands: `pnpm run deploy:commands`

**Code Changes**:
```typescript
// src/database/client.ts
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    ...
    type TEXT NOT NULL CHECK (type IN ('truth','dare','newtype')),
    ...
  )
`);

// src/commands/newtype.ts
export const data = new SlashCommandBuilder()
  .setName('newtype')
  .setDescription('Get a newtype question');

export async function execute(interaction, client, config) {
  const question = getNextQuestion('newtype');
  // ...
}
```

---

### Q: Can I use PostgreSQL instead of SQLite?

**A**: Yes, but requires refactoring

**Changes Required**:
1. Replace `better-sqlite3` with `pg` or ORM (Prisma, TypeORM)
2. Convert all synchronous DB calls to async/await
3. Update schema DDL for PostgreSQL syntax
4. Handle connection pooling
5. Update transaction syntax
6. Rewrite prepared statement caching

**Effort**: Medium (2-3 days)
**Benefit**: Better concurrency, horizontal scaling support

---

### Q: How do I backup the database?

**A**: Simple file copy (SQLite is file-based)

**Backup Script**:
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp data/todbot.db "$BACKUP_DIR/todbot_$TIMESTAMP.db"

# Keep only last 7 backups
ls -t "$BACKUP_DIR"/todbot_*.db | tail -n +8 | xargs -r rm

echo "Backup created: $BACKUP_DIR/todbot_$TIMESTAMP.db"
```

**Automated Backup** (cron):
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup.sh
```

---

### Q: How do I reset the bot?

**A**: Delete database and restart

**CAUTION**: This deletes ALL questions and submissions!

```bash
# 1. Stop bot
pm2 stop tod-bot

# 2. Backup database (optional)
cp data/todbot.db data/todbot_backup_$(date +%Y%m%d).db

# 3. Delete database
rm data/todbot.db

# 4. Start bot (recreates fresh database)
pm2 start tod-bot

# 5. Re-import questions if needed
pnpm run import:questions
```

---

### Q: Can I run multiple instances of the bot?

**A**: Not recommended with current architecture

**Issues**:
- SQLite file-based database (single writer limitation)
- In-memory caches not shared between instances
- Rotation state conflicts

**Solution for Scaling**:
1. Use PostgreSQL or MySQL (multi-writer support)
2. Add Redis for shared caching
3. Implement distributed locking for rotation state
4. Use PM2 cluster mode (requires refactoring)

**Current Recommendation**: Single instance, vertical scaling

---

### Q: How do I migrate to a new server?

**A**: Copy code and database

**Migration Steps**:
```bash
# On old server
tar -czf todbot_migration.tar.gz .env data/ logs/

# Transfer to new server
scp todbot_migration.tar.gz user@newserver:/path/to/

# On new server
cd /path/to/todbot
tar -xzf todbot_migration.tar.gz
pnpm install
pnpm build
pm2 start ecosystem.config.json

# Verify bot online in Discord
pm2 logs tod-bot
```

**Note**: Update `GUILD_ID` if moving to different Discord server

---

### Q: How do I contribute to the project?

**A**: See development guidelines in README.md and BEST_PRACTICES.md

**Quick Start**:
1. Fork repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes following BEST_PRACTICES.md
4. Test locally: `pnpm dev`
5. Commit: `git commit -m "Add feature: description"`
6. Push: `git push origin feature/my-feature`
7. Create pull request

---

## Getting Help

**Still stuck?**

1. **Check Logs**: `pm2 logs tod-bot` or `tail -f logs/tod-bot-*.log`
2. **Review Documentation**: README.md, PROJECT_KNOWLEDGE.md, BEST_PRACTICES.md
3. **Search Issues**: GitHub Issues (if public repo)
4. **Discord.js Docs**: https://discord.js.org/docs
5. **SQLite Docs**: https://www.sqlite.org/docs.html

**Reporting Issues**:
- Include error messages (full stack trace)
- Include relevant logs
- Describe steps to reproduce
- Include environment info (Node version, OS, etc.)

---

## Summary

**Most Common Issues**:
1. Slash commands not appearing → Run `pnpm run deploy:commands`
2. "Unknown interaction" → Defer long operations within 3 seconds
3. Database locked → Ensure single bot instance, enable WAL mode
4. Permission errors → Check role IDs in `.env`, verify Discord permissions
5. Import errors → Use `.js` extension in imports (even for `.ts` files)

**Debug Checklist**:
- [ ] Check PM2 status: `pm2 status`
- [ ] Check logs: `pm2 logs tod-bot`
- [ ] Check Discord bot online
- [ ] Check `.env` configuration
- [ ] Check database file exists and is writable
- [ ] Check Discord API status: https://discordstatus.com

**Best Practices to Avoid Issues**:
- Always re-deploy commands after structure changes
- Defer interactions for operations > 2 seconds
- Use `.js` extensions in all imports
- Keep database on fast storage (SSD)
- Monitor logs for warnings and errors
- Test with non-admin users for permission checks

Remember: When in doubt, check the logs first!
