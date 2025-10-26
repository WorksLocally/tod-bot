# Security Implementation Guide

This document provides detailed information about the security measures implemented in tod-bot and guidance for maintaining security.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Authentication & Authorization](#authentication--authorization)
3. [Input Validation & Sanitization](#input-validation--sanitization)
4. [Rate Limiting](#rate-limiting)
5. [Database Security](#database-security)
6. [Error Handling](#error-handling)
7. [Logging Security](#logging-security)
8. [Dependency Management](#dependency-management)
9. [Deployment Security](#deployment-security)
10. [Security Checklist](#security-checklist)

## Security Architecture

### Defense in Depth

The bot implements multiple layers of security:

1. **Input Layer**: Validation and sanitization of all user inputs
2. **Application Layer**: Rate limiting, permission checks, and business logic validation
3. **Data Layer**: Prepared statements, constraints, and transaction integrity
4. **Infrastructure Layer**: Environment variable management, secure token storage

### Security Principles

- **Least Privilege**: Bot and users have minimum necessary permissions
- **Fail Secure**: Errors default to denying access
- **Defense in Depth**: Multiple layers of protection
- **Secure by Default**: Secure configurations out of the box

## Authentication & Authorization

### Bot Authentication

The bot authenticates with Discord using a bot token:

```typescript
// Token is loaded from environment variables
const client = new Client({ ... });
await client.login(config.token);
```

**Security Measures:**
- Token stored in `.env` file (never in code)
- `.env` file is gitignored
- No token logging or error message exposure

### User Authorization

Role-based access control (RBAC) for privileged operations:

```typescript
// Permission check example
if (!hasPrivilegedRole(member, config.privilegedRoleIds)) {
  // Deny access
}
```

**Roles:**
- **Admin**: Full administrative access
- **Moderator**: Question approval/rejection
- **Question Master**: Question management
- **Regular Users**: Submit questions only

**Implementation:**
- Permission checks in `src/utils/permissions.ts`
- Used in all administrative commands
- Checks both role membership and Administrator permission

## Input Validation & Sanitization

### Sanitization Utility

All user inputs are sanitized using `sanitizeText()`:

```typescript
// Location: src/utils/sanitize.ts
export const sanitizeText = (input: string, options?: { maxLength?: number }): string => {
  // 1. Normalize line endings
  // 2. Remove control characters (except newlines)
  // 3. Trim whitespace
  // 4. Enforce length limits
}
```

**What it removes:**
- Control characters (U+0000 to U+001F except \n)
- Carriage returns
- Delete character (U+007F)
- Leading/trailing whitespace

**What it preserves:**
- Newlines (for multi-line questions)
- Unicode characters
- Emoji

### Validation Points

1. **Command Parameters**: Discord validates type and required fields
2. **Text Length**: Maximum 4000 characters enforced
3. **Question Type**: Restricted to 'truth' or 'dare'
4. **Empty Input**: Rejected after sanitization

## Rate Limiting

### Implementation

Two rate limiters protect against abuse:

```typescript
// Location: src/utils/rateLimiter.ts

// Submission rate limit: 5 submissions per 10 minutes
export const submissionRateLimiter = new RateLimiter(5, 10 * 60 * 1000);

// Question rate limit: 20 questions per minute
export const questionRateLimiter = new RateLimiter(20, 60 * 1000);
```

### Rate Limiter Features

- **Sliding Window**: Accurate rate limiting without burst allowance
- **Per-User Tracking**: Each user has independent limits
- **Automatic Cleanup**: Expired entries removed periodically
- **Memory Efficient**: Only tracks active users
- **Informative Feedback**: Users told when they can retry

### Usage Example

```typescript
if (submissionRateLimiter.isRateLimited(userId)) {
  const timeUntilReset = submissionRateLimiter.getTimeUntilReset(userId);
  // Inform user and deny request
}
```

## Database Security

### SQL Injection Prevention

All database operations use prepared statements:

```typescript
// Prepared statements are pre-compiled and cached
const STATEMENTS = {
  insertQuestion: db.prepare(
    'INSERT INTO questions (question_id, type, text, created_by, position) VALUES (?, ?, ?, ?, ?)'
  ),
  // ... more statements
};

// Parameters are bound securely
STATEMENTS.insertQuestion.run(questionId, type, text, createdBy, position);
```

**Why This is Safe:**
- SQL and data are separated
- No string concatenation
- Parameters properly escaped by better-sqlite3
- Statements compiled once, reused many times

### Database Constraints

```sql
-- Type validation
CHECK (type IN ('truth','dare'))

-- Status validation  
CHECK (status IN ('pending','approved','rejected'))

-- Unique constraints
UNIQUE (question_id)
UNIQUE (submission_id)
UNIQUE (type, position)

-- Foreign key enforcement
PRAGMA foreign_keys = ON;
```

### Transaction Safety

Critical operations use transactions:

```typescript
const insert = db.transaction(() => {
  // Multiple operations executed atomically
  // Either all succeed or all fail
});
```

### Database File Security

- Location configurable via `DATABASE_PATH`
- Default: `./data/todbot.db`
- Recommended: Set restrictive file permissions (chmod 600)
- Not exposed via HTTP or network

## Error Handling

### Error Response Strategy

**User-Facing Errors:**
```typescript
// Generic, safe messages
"There was an error while executing this command."
"Unable to process your request."
```

**Logged Errors:**
```typescript
logger.error('Detailed error information', {
  error,
  context: 'sensitive data here'
});
```

### Error Information Flow

```
Error Occurs
    ↓
Logged with full details (file only)
    ↓
Generic message to user
    ↓
No stack traces exposed
```

### Sensitive Information Protection

**Never expose:**
- Stack traces
- Database paths
- Internal IDs or structure
- Configuration details
- Token fragments

**Safe to expose:**
- Question/submission IDs (designed to be shared)
- Generic error messages
- User-provided content (after sanitization)

## Logging Security

### Logger Configuration

```typescript
// Location: src/utils/logger.ts

// Sensitive data sanitization
const sanitizeMeta = (value: unknown): unknown => {
  // Handle circular references
  // Sanitize Error objects
  // Remove sensitive fields
}
```

### What Gets Logged

**Logged:**
- User IDs (Discord IDs are public)
- Submission/question IDs
- Command execution
- Error details
- Rate limit events

**Never Logged:**
- Bot token
- Raw passwords (N/A for this bot)
- Full user objects (privacy)
- Message content (unless it's a submission)

### Log Storage

- Location: `./logs/`
- Rotation: Daily with compression
- Retention: 14 days (configurable)
- Access: Restricted to bot process owner

## Dependency Management

### Vulnerability Scanning

**Automated:**
- Dependabot daily checks
- GitHub security advisories
- CodeQL analysis weekly

**Manual:**
```bash
pnpm audit
pnpm audit --audit-level=moderate
```

### Update Strategy

1. Dependabot creates PRs for updates
2. CI runs tests and linting
3. Review changes
4. Merge if tests pass
5. Deploy to production

### Minimal Dependencies

The bot uses only necessary dependencies:
- `discord.js`: Discord API client
- `better-sqlite3`: Database
- `winston`: Logging
- `dotenv`: Environment variables
- `typescript`: Type safety

## Deployment Security

### Environment Variables

**Required:**
```bash
DISCORD_TOKEN=       # Bot token - CRITICAL
CLIENT_ID=          # Application ID
GUILD_ID=           # Guild ID
APPROVAL_CHANNEL_ID= # Channel for submissions
ADMIN_ROLE_ID=      # Admin role
MODERATOR_ROLE_ID=  # Moderator role
QUESTION_MASTER_ROLE_ID= # Question master role
```

**Optional:**
```bash
DATABASE_PATH=      # Database location
LOG_LEVEL=         # Logging verbosity
LOG_MAX_FILES=     # Log retention
```

### Secure Deployment Checklist

- [ ] Create `.env` from `.env.example`
- [ ] Set `.env` permissions to 600 (owner read/write only)
- [ ] Never commit `.env` to version control
- [ ] Use process manager (PM2, systemd) for auto-restart
- [ ] Set up log rotation
- [ ] Regular backups of database
- [ ] Monitor logs for suspicious activity
- [ ] Keep bot updated with security patches

### File Permissions

```bash
# .env file
chmod 600 .env

# Database directory
chmod 700 data/

# Database file
chmod 600 data/todbot.db

# Log directory
chmod 700 logs/
```

### Network Security

**Bot Does NOT:**
- Open network ports
- Accept incoming connections
- Expose HTTP endpoints
- Make outbound requests (except Discord API)

**Bot DOES:**
- Connect to Discord WebSocket (wss://gateway.discord.gg)
- Use Discord REST API (https://discord.com/api)

## Security Checklist

### Development

- [ ] Never commit secrets or tokens
- [ ] Use prepared statements for SQL
- [ ] Sanitize all user inputs
- [ ] Check permissions before privileged operations
- [ ] Use rate limiting on user-facing commands
- [ ] Log security events
- [ ] Handle errors gracefully
- [ ] Review dependencies regularly

### Deployment

- [ ] Secure `.env` file (chmod 600)
- [ ] Secure database file (chmod 600)
- [ ] Use least privilege for bot process user
- [ ] Enable firewall rules
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Backup database regularly
- [ ] Review logs periodically

### Code Review

- [ ] Input validation present
- [ ] Permission checks in place
- [ ] No secrets in code
- [ ] Error messages are generic
- [ ] SQL uses prepared statements
- [ ] Rate limiting applied where needed
- [ ] Logging doesn't expose sensitive data
- [ ] Dependencies are up to date

### Testing

- [ ] Test with malicious inputs
- [ ] Verify permission checks work
- [ ] Test rate limiting behavior
- [ ] Confirm sanitization works
- [ ] Test error handling
- [ ] Verify no information leakage

## Incident Response

### If Token is Compromised

1. **Immediately**: Regenerate token in Discord Developer Portal
2. Update `.env` with new token
3. Restart bot
4. Review logs for unauthorized activity
5. Check for unauthorized configuration changes
6. Document incident

### If Database is Compromised

1. **Immediately**: Stop the bot
2. Assess damage (data modified/deleted?)
3. Restore from backup if needed
4. Review how access was gained
5. Fix vulnerability
6. Change credentials if applicable
7. Restart bot
8. Monitor closely

### Reporting Security Issues

See [SECURITY.md](SECURITY.md) for vulnerability reporting process.

## Additional Resources

- [Discord Developer Documentation](https://discord.com/developers/docs)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [SQLite Security](https://www.sqlite.org/security.html)

## Updates

This document should be updated when:
- New security features are added
- Security vulnerabilities are discovered and fixed
- Dependencies change significantly
- Deployment architecture changes

Last Updated: 2025-10-26
