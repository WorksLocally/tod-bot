# Project Knowledge: TOD-Bot Architecture & Integration Points

## Table of Contents
- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [Key Integration Points](#key-integration-points)
- [Data Flow Patterns](#data-flow-patterns)
- [Module Structure](#module-structure)
- [Caching Strategy](#caching-strategy)
- [Security Architecture](#security-architecture)
- [Performance Characteristics](#performance-characteristics)

---

## Project Overview

**Project**: Truth or Dare Discord Bot (tod-bot)
**Type**: Self-hosted Discord bot application with submission approval workflow
**Version**: 0.1.0
**Runtime**: Node.js 20.10+ with TypeScript
**Package Manager**: pnpm

### Purpose
TOD-Bot delivers curated truth and dare questions to Discord users while enabling community submissions through a moderated approval workflow. The bot provides sequential question rotation, duplicate detection, and role-based question management.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Discord API                          │
│              (External Integration)                     │
└──────────────────────────┬──────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Client    │ (index.ts)
                    │ (discord.js)│
                    │             │
                    │ - Event     │
                    │   Router    │
                    │ - Command   │
                    │   Loader    │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼───────┐   ┌────▼────────┐  ┌─────▼──────┐
    │ Slash      │   │   Button    │  │   Modal    │
    │ Commands   │   │   Handlers  │  │  Handlers  │
    │            │   │             │  │            │
    │ - truth    │   │ - approve   │  │ - submit   │
    │ - dare     │   │ - reject    │  │ - reason   │
    │ - submit   │   │ - next      │  └────────────┘
    │ - question │   │ - confirm   │
    └────┬───────┘   └────┬────────┘
         │                │
         └────────┬───────┘
                  │
         ┌────────▼──────────────────┐
         │    Services Layer         │
         │  (Business Logic)         │
         │                           │
         │  ┌─────────────────────┐ │
         │  │ questionService     │ │  - Question CRUD
         │  │                     │ │  - Rotation logic
         │  ├─────────────────────┤ │
         │  │ submissionService   │ │  - Submission lifecycle
         │  │                     │ │  - Status management
         │  ├─────────────────────┤ │
         │  │ approvalService     │ │  - Approval workflow
         │  │                     │ │  - Notification system
         │  ├─────────────────────┤ │
         │  │ similarityService   │ │  - Duplicate detection
         │  │                     │ │  - Levenshtein distance
         │  └─────────────────────┘ │
         └────────┬──────────────────┘
                  │
         ┌────────▼──────────────────┐
         │   Database Layer          │
         │  (better-sqlite3)         │
         │                           │
         │  - questions              │
         │  - rotation_state         │
         │  - submissions            │
         │                           │
         │  Features:                │
         │  - WAL mode               │
         │  - Prepared statements    │
         │  - Transactions           │
         │  - FK constraints         │
         └───────────────────────────┘
```

### Layer Responsibilities

#### Presentation Layer (Commands/Handlers)
- **Responsibility**: Discord interaction handling, input validation, UI component construction
- **Key Files**: `src/commands/*`, `src/interactions/*`
- **Integration**: Receives Discord events, delegates to services, returns Discord messages

#### Business Logic Layer (Services)
- **Responsibility**: Core application logic, workflow orchestration, caching
- **Key Files**: `src/services/*`
- **Integration**: Coordinates between handlers and database, implements business rules

#### Data Access Layer (Database)
- **Responsibility**: Data persistence, query execution, schema management
- **Key Files**: `src/database/client.ts`
- **Integration**: SQLite operations via better-sqlite3, prepared statement management

---

## Technology Stack

### Core Dependencies

| Package | Version | Purpose | Notes |
|---------|---------|---------|-------|
| discord.js | 14.23.2 | Discord API client | Event handling, interaction routing |
| better-sqlite3 | ^12.4.1 | SQLite database | Synchronous bindings, high performance |
| TypeScript | ^5.9.3 | Type safety | Strict mode, ES2022 target |
| winston | ^3.12.0 | Structured logging | Multiple transports, error handling |
| winston-daily-rotate-file | ^5.0.0 | Log rotation | Daily rotation, compression |
| dotenv | ^16.4.5 | Configuration | Environment variable loading |
| tsx | ^4.20.6 | Script execution | TypeScript runner for dev/scripts |

### Why These Technologies?

**discord.js**: De facto standard for Discord bots with comprehensive API coverage
**better-sqlite3**: Synchronous API simplifies code, excellent performance for embedded database
**TypeScript**: Type safety prevents runtime errors, improves maintainability
**winston**: Production-grade logging with rotation and error handling
**better-sqlite3 over other ORMs**: Direct SQL control, prepared statement caching, no async complexity

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────────┐
│     questions       │
├─────────────────────┤
│ id (PK)             │
│ question_id (UNIQUE)│────┐
│ type                │    │
│ text                │    │
│ created_by          │    │
│ created_at          │    │
│ updated_at          │    │
│ position            │    │  Referenced in
└─────────────────────┘    │  approval process
         │                 │
         │ Referenced by   │
         │ rotation_state  │
         │                 │
         ▼                 │
┌─────────────────────┐    │
│   rotation_state    │    │
├─────────────────────┤    │
│ type (PK)           │    │
│ last_position       │    │
└─────────────────────┘    │
                           │
┌─────────────────────┐    │
│    submissions      │    │
├─────────────────────┤    │
│ id (PK)             │    │
│ submission_id (UK)  │────┘
│ type                │
│ text                │
│ user_id             │
│ guild_id            │
│ status              │
│ created_at          │
│ resolved_at         │
│ resolver_id         │
│ approval_message_id │
│ approval_channel_id │
└─────────────────────┘
```

### Table Details

#### `questions`
**Purpose**: Stores all approved questions with rotation tracking
**Key Indexes**:
- `idx_questions_type_position` (UNIQUE): Enables efficient rotation queries
- `idx_questions_type`: Fast filtering by type

**Critical Columns**:
- `question_id`: 8-character alphanumeric identifier (user-facing)
- `position`: Rotation order within type (0-based, sequential)
- `type`: 'truth' or 'dare' (CHECK constraint)

#### `rotation_state`
**Purpose**: Tracks the last served question position per type
**Design**: Simple key-value store with type as key
**Usage**: Updated atomically with question retrieval to maintain rotation state

#### `submissions`
**Purpose**: Manages user submission lifecycle from pending to approved/rejected
**Key Indexes**:
- `idx_submissions_status`: Fast pending submission queries
- `idx_submissions_user_status`: User submission history
- `idx_submissions_type_status`: Type-specific filtering

**Status Flow**: `pending` → `approved` OR `rejected`
**Integration**: Links to Discord via `approval_message_id` and `approval_channel_id`

---

## Key Integration Points

### 1. Discord API Integration

#### Command Registration
**File**: `scripts/deploy-commands.ts`
**Process**:
1. Loads all command modules from `src/commands/`
2. Builds SlashCommandBuilder instances
3. Uses Discord REST API to register commands
4. Scope: Guild-specific (faster updates, no global propagation delay)

**When to Re-deploy**:
- Adding new commands
- Modifying command structure (options, descriptions)
- Changing command permissions

#### Event Handling
**File**: `src/index.ts`
**Events**:
- `ClientReady`: Bot startup confirmation
- `InteractionCreate`: Routing hub for all Discord interactions

**Routing Logic**:
```typescript
if (interaction.isChatInputCommand()) {
  // Route to command handlers
  const command = commands.get(interaction.commandName);
  await command.execute(interaction, client, config);
}
else if (interaction.isButton()) {
  // Direct ID match or predicate-based routing
  const handler = buttonHandlers.find(h => matches(h, interaction));
  await handler.execute(interaction, client, config);
}
else if (interaction.isModalSubmit()) {
  // Custom ID pattern matching
  if (interaction.customId.startsWith('question_submit_modal')) {
    // Route to modal handler
  }
}
```

### 2. Database Integration

#### Connection Management
**File**: `src/database/client.ts`
**Singleton Pattern**: Single `db` instance exported and imported by services

**Configuration**:
```typescript
- WAL mode: Enables concurrent reads during writes
- Foreign keys: Enforced constraints
- Better-sqlite3: Synchronous operations (no async/await for DB)
```

**Migration Strategy**:
- Automatic schema initialization on first run
- Manual migration code in `client.ts` for schema changes
- Example: Position uniqueness migration added in code

#### Prepared Statement Caching
**Location**: `src/services/questionService.ts`
**Pattern**:
```typescript
const stmtCache = new Map<string, Statement>();

function getOrPrepare(key: string, sql: string) {
  if (!stmtCache.has(key)) {
    stmtCache.set(key, db.prepare(sql));
  }
  return stmtCache.get(key);
}
```

**Benefits**:
- Avoids repeated SQL parsing
- Improves query performance
- Prevents SQL injection via parameterization

### 3. Service Layer Integration

#### Service-to-Service Communication

**Approval Flow Example**:
```typescript
// approvalService calls submissionService
submissionService.setApprovalMessage(submissionId, messageId, channelId);

// approvalService calls questionService
questionService.addQuestion(type, text, userId);

// approvalService calls similarityService
const similar = similarityService.findSimilarQuestions(text, type, 3);
```

**Pattern**: Services are stateless, operate via function calls
**No Circular Dependencies**: Unidirectional dependency graph

#### Service-to-Database Integration
**Pattern**: Services own prepared statements, execute queries, return typed results
**Transaction Usage**: Explicit `db.transaction()` for atomic operations

### 4. Caching Integration

#### Cache Instances and Owners

| Cache | Owner | Capacity | Purpose |
|-------|-------|----------|---------|
| questionCache | questionService | 100 | Question lookups by ID |
| nextQuestionCache | questionService | 50 | Recently served questions |
| userCache | approvalService | 100 | Discord user objects |
| cachedApprovalChannel | approvalService | 1 | Approval channel reference |
| cachedApprovalButtons | approvalService | 1 | Action row components |

**Cache Invalidation**:
- LRU eviction on capacity (automatic)
- Manual invalidation on question edit/delete
- No TTL-based expiration (static data)

### 5. Rate Limiting Integration

#### Limiter Instances

**Submission Rate Limiter**:
- Location: `src/commands/submit.ts`
- Limit: 10 requests per 5 minutes per user
- Response: Ephemeral error with time remaining

**Question Rate Limiter**:
- Location: `src/commands/truth.ts`, `src/commands/dare.ts`
- Limit: 20 requests per 1 minute per user
- Response: Ephemeral error with reset time

**Integration Pattern**:
```typescript
const limiter = new RateLimiter(maxRequests, timeWindowMs);

if (!limiter.tryAcquire(userId)) {
  const resetMs = limiter.getTimeUntilReset(userId);
  return interaction.reply({
    content: `Rate limit exceeded. Try again in ${resetMs}ms`,
    ephemeral: true
  });
}
```

---

## Data Flow Patterns

### Pattern 1: Question Retrieval Flow

```
User → /truth command
  ↓
truth.ts handler
  ↓
questionService.getNextQuestion('truth')
  ├─ Query questions table (type='truth', ORDER BY position)
  ├─ Get current rotation_state.last_position
  ├─ Find next question in sequence
  ├─ Update rotation_state (wrap around if needed)
  └─ Cache result in nextQuestionCache
  ↓
Build embed with question text
  ↓
Attach "Next Truth" button
  ↓
Reply to interaction
```

**Key Characteristics**:
- Sequential rotation ensures all questions served
- Atomic rotation state update
- Cache for performance
- Stateless operation (rotation state in DB)

### Pattern 2: Submission Approval Flow

```
User → /submit command
  ↓
submit.ts handler
  ├─ Sanitize input text
  ├─ Check rate limit
  └─ Find similar questions
  ↓
If similar questions found:
  ├─ Show warning embed
  └─ Provide confirm/cancel buttons
  ↓
User clicks "Submit Anyway"
  ↓
submitConfirm.ts button handler
  ↓
submissionService.createSubmission()
  ├─ Generate unique submission_id
  ├─ Insert into submissions table (status='pending')
  └─ Return submission object
  ↓
approvalService.postSubmissionForApproval()
  ├─ Fetch approval channel
  ├─ Build submission embed with metadata
  ├─ Add approve/reject buttons
  ├─ Send message to approval channel
  └─ Store message ID in submission record
  ↓
Moderator clicks "Approve"
  ↓
approvalApprove.ts button handler
  ├─ Check permissions
  ├─ Extract submission_id from button customId
  ├─ Fetch submission details
  └─ Call approvalService.approveSubmission()
  ↓
approvalService.approveSubmission()
  ├─ Check for duplicates again
  ├─ Add question via questionService.addQuestion()
  ├─ Update submission status to 'approved'
  ├─ Update approval message with checkmark
  ├─ Notify submitter via DM with question_id
  └─ Log approval event
```

**Key Characteristics**:
- Multi-step workflow with state tracking
- Duplicate detection at submission AND approval
- Permission checking at critical operations
- Atomic status updates
- User notification for feedback loop

### Pattern 3: Question Management Flow

```
Moderator → /question list command
  ↓
list.ts handler
  ├─ Check permissions
  └─ Get type filter from options
  ↓
questionService.listQuestions(type?)
  ├─ Query questions table
  └─ Return all matching questions
  ↓
Paginate results (10 per page)
  ↓
Build embed with question list
  ↓
Attach pagination buttons (prev/next)
  ↓
Reply to interaction
  ↓
User clicks "Next Page"
  ↓
questionListPagination.ts button handler
  ├─ Parse page number from customId
  ├─ Rebuild embed with new page
  └─ Update message
```

**Key Characteristics**:
- Permission-gated operations
- Pagination for large datasets
- Stateless pagination (page number in button ID)
- Instant response (cached queries)

---

## Module Structure

### Command Modules

**Location**: `src/commands/`
**Pattern**: Each command exports `{ data, execute }`

**Example Structure**:
```typescript
// src/commands/truth.ts
export const data = new SlashCommandBuilder()
  .setName('truth')
  .setDescription('Get a truth question');

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client,
  config: BotConfig
) {
  // Implementation
}
```

**Subcommand Pattern**:
```
src/commands/question.ts (router)
src/commands/question/
  ├── add.ts (handler)
  ├── delete.ts (handler)
  ├── edit.ts (handler)
  ├── list.ts (handler)
  ├── view.ts (handler)
  └── shared.ts (utilities)
```

### Interaction Handlers

**Button Handlers**:
- **Location**: `src/interactions/buttons/`
- **Pattern**: Export `{ customId OR shouldHandle, execute }`
- **Routing**: Direct ID match first, then predicate-based matching

**Example**:
```typescript
// Direct ID match
export const customId = 'approval_approve';

// Predicate match
export function shouldHandle(interaction: ButtonInteraction): boolean {
  return interaction.customId.startsWith('submit_confirm:');
}

export async function execute(
  interaction: ButtonInteraction,
  client: Client,
  config: BotConfig
) {
  // Implementation
}
```

**Modal Handlers**:
- **Location**: `src/interactions/modals/`
- **Pattern**: Custom ID pattern matching in `index.ts`
- **Data Extraction**: Field values from `interaction.fields`

### Service Modules

**Location**: `src/services/`
**Pattern**: Pure functions, stateless operations (except caches)
**Responsibilities**: Business logic, database operations, external API calls

**Module Boundaries**:
- `questionService`: Question CRUD, rotation
- `submissionService`: Submission lifecycle
- `approvalService`: Workflow orchestration
- `similarityService`: Comparison algorithms

**No Circular Dependencies**: Services can call other services unidirectionally

### Utility Modules

**Location**: `src/utils/`
**Categories**:

| Category | Modules | Purpose |
|----------|---------|---------|
| Security | permissions.ts, sanitize.ts | Authorization, input safety |
| Infrastructure | logger.ts, id.ts, lruCache.ts | Logging, ID gen, caching |
| Discord Helpers | questionEmbeds.ts, paginationComponents.ts, similarityWarning.ts | UI builders |
| Core Utilities | rateLimiter.ts, fileWalker.ts, pendingSubmissionCache.ts | Rate limiting, module loading |

---

## Caching Strategy

### Cache Architecture

**Technology**: Custom LRU (Least Recently Used) implementation
**File**: `src/utils/lruCache.ts`

**Design**:
```typescript
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private readonly capacity: number;

  get(key: K): V | undefined {
    // Move to end (mark as recently used)
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

**Performance**: O(1) get/set operations via Map

### Cache Invalidation Strategy

**Question Cache**:
- **Invalidate on**: Question edit, question delete
- **Pattern**: Explicit `cache.delete(questionId)` after mutation
- **No TTL**: Questions are static until explicitly changed

**User/Channel Cache**:
- **Invalidate on**: Never (Discord objects rarely change)
- **Eviction**: LRU only (oldest entries removed at capacity)

**Rotation Cache**:
- **Invalidate on**: Question add/delete (rotation positions change)
- **Pattern**: Clear entire cache on structural changes

---

## Security Architecture

### Authentication Model

**Bot Authentication**:
- Token stored in `DISCORD_TOKEN` environment variable
- Loaded via dotenv at startup
- Never logged or exposed in error messages

**User Authentication**:
- Handled by Discord (OAuth2 implicit)
- Bot receives authenticated interaction objects
- User ID embedded in interaction context

### Authorization Model

**Role-Based Access Control (RBAC)**:
```typescript
function hasPrivilegedRole(
  member: GuildMember,
  privilegedRoleIds: string[]
): boolean {
  // Check 1: Administrator permission
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check 2: Custom role membership
  return member.roles.cache.some(role =>
    privilegedRoleIds.includes(role.id)
  );
}
```

**Privilege Levels**:
- **Public**: All users (truth, dare, submit)
- **Moderators**: Configured role IDs (approve, reject, question management)

**Enforcement Points**:
- Command handlers (before execution)
- Button handlers (before processing)
- Service methods (defensive checks)

### Input Validation

**Sanitization Pipeline**:
```typescript
// File: src/utils/sanitize.ts
function sanitizeText(text: string, maxLength: number): string {
  // 1. Normalize line endings
  let sanitized = text.replace(/\r\n/g, '\n');

  // 2. Remove control characters (except \n and \t)
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

**Validation Layers**:
1. Discord.js type checking (automatic)
2. Sanitization for all user input
3. Length validation (max 4000 chars for questions)
4. Type checking via TypeScript
5. Database constraints (CHECK, UNIQUE, NOT NULL)

### SQL Injection Prevention

**Prepared Statements Only**:
```typescript
// SAFE - Parameterized query
const stmt = db.prepare('SELECT * FROM questions WHERE type = ?');
const result = stmt.all(type);

// NEVER DONE - String interpolation
// const result = db.prepare(`SELECT * FROM questions WHERE type = '${type}'`).all();
```

**All Queries Use Parameters**: No string concatenation in SQL

### Rate Limiting

**Purpose**: Prevent spam, abuse, and resource exhaustion

**Implementation**:
- Sliding window algorithm
- Per-user tracking via Discord user ID
- Automatic cleanup of expired entries

**Limits**:
- Submissions: 10 per 5 minutes
- Questions: 20 per 1 minute

---

## Performance Characteristics

### Database Performance

**Optimizations**:
1. **WAL Mode**: Concurrent reads during writes
2. **Indexes**:
   - `idx_questions_type_position` (UNIQUE): Rotation queries
   - `idx_questions_type`: Filtering
   - `idx_submissions_status`: Pending submission queries
3. **Prepared Statement Caching**: Avoid repeated SQL parsing
4. **Transactions**: Atomic multi-statement operations

**Query Patterns**:
- **Question Retrieval**: O(log n) via indexed lookup
- **Rotation Update**: O(1) key-value update
- **Submission List**: O(n) filtered by indexed status

### Caching Performance

**Cache Hit Rates** (estimated):
- Question cache: 80-90% (frequently accessed questions)
- User cache: 95%+ (repeated moderator actions)
- Channel cache: 99%+ (single approval channel)

**Cache Overhead**:
- Memory: ~100 questions × ~100 bytes = ~10KB
- Lookup: O(1) via Map
- Eviction: O(1) via Map.delete()

### Network Performance

**Discord API Calls**:
- Rate limited by Discord (global + per-route limits)
- Cached channel/user fetches reduce API calls
- Ephemeral responses reduce message load

**Optimization Strategies**:
- Batch operations where possible
- Cache Discord objects aggressively
- Use interaction updates instead of new messages

### Memory Management

**Process Limits**:
- PM2 max memory: 1GB
- Automatic restart on memory threshold

**Memory Usage**:
- Base process: ~50MB
- Database connection: ~10MB
- Caches: ~1MB
- Logs: Rotated daily, max 14 days

### Logging Performance

**Fast Path Optimization**:
```typescript
// Fast path for primitives (no serialization)
if (typeof meta === 'string' || typeof meta === 'number') {
  return logger.log(level, message, meta);
}

// Slow path for objects (serialization + sanitization)
const sanitized = sanitizeMetadata(meta);
return logger.log(level, message, sanitized);
```

**Log Rotation**: Daily rotation prevents unbounded growth

---

## Development Workflow Integration Points

### Local Development

**Setup**:
```bash
pnpm install          # Install dependencies
cp .env.example .env  # Configure environment
pnpm run deploy:commands  # Register slash commands
pnpm dev              # Start with hot reload
```

**Key Scripts**:
- `pnpm dev`: Watch mode with tsx (auto-reload on changes)
- `pnpm lint`: ESLint checking
- `pnpm lint:fix`: Auto-fix linting issues

### Command Deployment

**When to Re-deploy**:
- Adding new commands
- Changing command structure (options, descriptions)
- Modifying permissions

**Command**:
```bash
pnpm run deploy:commands
```

**Process**:
1. Loads command modules
2. Builds SlashCommandBuilder instances
3. Calls Discord REST API to register commands
4. Guild-scoped (instant updates, no global propagation delay)

### Production Deployment

**PM2 Configuration** (`ecosystem.config.json`):
```json
{
  "name": "tod-bot",
  "script": "./dist/src/index.js",
  "watch": true,
  "ignore_watch": ["logs", "node_modules", "data/**", ".git"],
  "instances": 1,
  "autorestart": true,
  "max_memory_restart": "1G"
}
```

**Deployment Steps**:
1. Build: `pnpm build` (compiles TypeScript)
2. Deploy: Copy dist/, data/, logs/ to production
3. Install: `pnpm install --prod`
4. Start: `pm2 start ecosystem.config.json`

---

## External Dependencies & APIs

### Discord API

**Version**: Discord API v10 (via discord.js v14)
**Authentication**: Bot token (Discord Developer Portal)

**Key API Surfaces Used**:
- **Gateway**: WebSocket connection for events (ClientReady, InteractionCreate)
- **Interactions**: Slash commands, buttons, modals
- **REST**: Channel fetching, message sending, DMs
- **Permissions**: Role checks, permission bits

**Rate Limits**:
- Global: 50 requests/second
- Per-route: Varies (e.g., 5 messages/5 seconds per channel)
- Handled automatically by discord.js

### File System

**Usage**:
- Database: `./data/todbot.db`
- Logs: `./logs/tod-bot-YYYY-MM-DD.log`
- Config: `.env` file

**Permissions Required**:
- Read/write access to `./data/` and `./logs/`
- Read access to `.env`

### Node.js APIs

**Critical APIs**:
- `crypto.randomInt()`: Secure ID generation
- `fs/promises`: Async file operations (log rotation)
- `path`: Cross-platform path handling
- `process`: Environment variables, exit codes

---

## Configuration Management

### Environment Variables

**Required**:
```bash
DISCORD_TOKEN           # Bot token from Discord Developer Portal
CLIENT_ID               # Application ID
GUILD_ID                # Target guild (server) ID
APPROVAL_CHANNEL_ID     # Channel for submission approvals
```

**Optional**:
```bash
ADMIN_ROLE_ID           # Administrator role ID
MODERATOR_ROLE_ID       # Moderator role ID
QUESTION_MASTER_ROLE_ID # Question manager role ID
DATABASE_PATH           # Database file path (default: ./data/todbot.db)
LOG_LEVEL               # Logging level (default: 'info')
LOG_MAX_FILES           # Log retention (default: '14d')
```

**Validation**:
- Missing required variables: Process exits with error
- Invalid values: Logged as warnings, use defaults

### Configuration Loading

**File**: `src/config/env.ts`
**Process**:
1. Search for `.env` in multiple paths (CWD, module dir, parent)
2. Load via dotenv
3. Validate required fields
4. Build typed `BotConfig` object
5. Export singleton instance

**Type Safety**:
```typescript
interface BotConfig {
  discordToken: string;
  clientId: string;
  guildId: string;
  approvalChannelId: string;
  privilegedRoleIds: string[];
  databasePath: string;
  logLevel: string;
  logMaxFiles: string;
}
```

---

## Key Architectural Decisions

### Decision 1: Synchronous Database Operations

**Rationale**:
- better-sqlite3 provides synchronous API
- Simplifies code (no async/await for DB)
- Better performance for embedded database
- Node.js event loop handles concurrency

**Trade-offs**:
- Blocking DB operations (acceptable for SQLite performance)
- Cannot use async ORMs (Prisma, TypeORM)

### Decision 2: Sequential Question Rotation

**Rationale**:
- Ensures all questions served before repeating
- Fair distribution of content
- Predictable behavior for moderators

**Implementation**:
- Position field per question
- Rotation state tracks last served position
- Wrap-around to position 0 when reaching end

**Trade-offs**:
- Predictable order (less "random" feel)
- Requires position management on add/delete

### Decision 3: Guild-Scoped Commands

**Rationale**:
- Instant command updates (no global propagation delay)
- Self-hosted bot (single guild deployment)
- Faster development iteration

**Trade-offs**:
- Cannot be used across multiple guilds without re-deployment
- Requires guild ID in configuration

### Decision 4: Approval Channel Pattern

**Rationale**:
- Centralized moderation workflow
- Transparent submission queue
- Leverages Discord's native UX (buttons, embeds)

**Implementation**:
- Dedicated channel configured via `APPROVAL_CHANNEL_ID`
- Submissions posted as embeds with action buttons
- Message updates reflect approval/rejection status

**Trade-offs**:
- Requires channel setup and configuration
- Single approval channel (no distributed moderation)

### Decision 5: In-Memory Caching with LRU Eviction

**Rationale**:
- Fast lookups (O(1) Map operations)
- Automatic memory management (LRU eviction)
- No external cache dependencies (Redis, etc.)

**Trade-offs**:
- Cache cleared on process restart
- Limited capacity (100 questions)
- Not shared across bot instances (if scaled horizontally)

---

## Monitoring & Observability

### Logging

**Log Levels**:
- `info`: Normal operations (bot startup, command execution)
- `warn`: Recoverable errors (user not found, API failures)
- `error`: Critical failures (DB errors, unhandled exceptions)

**Log Locations**:
- Console: Real-time output (development)
- File: `./logs/tod-bot-YYYY-MM-DD.log` (production)

**Log Rotation**:
- Daily rotation
- Compression of old logs
- Retention: 14 days

**Searchable Fields**:
- Timestamp (ISO 8601)
- Level (info, warn, error)
- Message (human-readable)
- Metadata (structured JSON)

### Error Handling

**Error Boundaries**:
1. **Command Level**: Try/catch in command handlers
2. **Service Level**: Error propagation to caller
3. **Interaction Level**: Discord error responses (ephemeral)
4. **Process Level**: Uncaught exception handlers

**Error Responses**:
- User-facing: Ephemeral messages with friendly errors
- Logs: Full error objects with stack traces
- No sensitive data exposure in user messages

### Health Monitoring

**Indicators**:
- Discord client connected (ClientReady event)
- Database queries succeeding
- Log files being written

**No Built-in Health Endpoint** (Discord bot, not HTTP server)

**PM2 Monitoring**:
- Process uptime
- Memory usage
- CPU usage
- Restart count

---

## Scaling Considerations

### Current Architecture Limitations

**Single Instance**:
- Not designed for horizontal scaling
- In-memory caches not shared
- SQLite file-based (single writer)

**Bottlenecks**:
- Database: SQLite write concurrency (WAL mode helps)
- Discord API rate limits (handled by discord.js)
- Memory: Capped at 1GB (PM2 config)

### Scaling Options

**Vertical Scaling**:
- Increase memory limit
- Faster disk I/O for database
- More CPU cores (limited benefit for single-threaded DB)

**Horizontal Scaling** (requires refactoring):
- Replace SQLite with PostgreSQL/MySQL
- Add Redis for shared caching
- Implement distributed rate limiting
- Shared state for rotation tracking

**Current Recommendation**: Vertical scaling sufficient for typical Discord bot workloads

---

## Summary

TOD-Bot is a well-architected Discord bot with clear separation of concerns, robust error handling, and security best practices. The codebase emphasizes:

- **Type Safety**: Full TypeScript with strict mode
- **Performance**: Caching, prepared statements, indexes
- **Security**: Input validation, rate limiting, RBAC
- **Maintainability**: Modular structure, clear boundaries
- **Observability**: Comprehensive logging, error handling

**Integration Points**:
- Discord API (events, interactions, REST)
- SQLite database (better-sqlite3)
- File system (logs, config, database)
- Environment configuration (.env)

**Key Patterns**:
- Service layer abstraction
- Repository pattern for database
- Command/handler pattern for Discord
- LRU caching for performance
- Rate limiting for protection

This architecture supports the current feature set well and provides a solid foundation for future enhancements.
