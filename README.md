# Truth or Dare Bot

Self-hosted Discord bot that delivers curated truth and dare questions with a submission and approval workflow inspired by [truthordarebot.xyz](https://truthordarebot.xyz/).

## Requirements

- Node.js 20.x, 22.x, or 24.x
- pnpm 10.19.x (install with `corepack prepare pnpm@10.19.0 --activate` once Node is available)
- A Discord application with bot token and slash command scopes

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Duplicate `.env.example` to `.env` and populate the following:
   - `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`
   - `APPROVAL_CHANNEL_ID`
   - `ADMIN_ROLE_ID`, `MODERATOR_ROLE_ID`, `QUESTION_MASTER_ROLE_ID`
   - Optional `DATABASE_PATH` (defaults to `./data/todbot.db`)
3. Register slash commands for your guild:
   ```bash
   pnpm run deploy:commands
   ```
4. Start the bot:
   ```bash
   pnpm start
   ```

The database is created automatically on first run using SQLite3 via `better-sqlite3`.

## Slash Commands

- `/truth` - Serve the next truth question and reuse buttons for more.
- `/dare` - Serve the next dare question.
- `/submit` - Opens a modal for users to submit questions for moderator approval. Posts to the configured channel with pending status.

### Moderator Commands (`/question`)

- `add` - Add a question directly or approve a submission. Assigns an 8-character ID and updates approval status.
- `delete` - Remove a question by ID.
- `edit` - Update the text of a question.
- `list` - Show all questions (optionally filtered by type).
- `view` - Show question details by ID.

## Approval Workflow

1. `/submit` opens a modal for users to enter their question, then posts an embed to the approval channel with Approve and Reject buttons.
2. Moderators click the **Approve** button to approve the submission, which:
   - Assigns an 8-character ID, adds to the question rotation, updates the embed, and DMs the submitter.
3. Moderators click the **Reject** button to reject the submission, which:
   - Opens a modal for an optional rejection reason, updates the embed, and DMs the submitter with the reason.

## Project Structure

- `src/index.ts` - Discord client bootstrap and interaction routing.
- `src/commands/` - Slash command handlers (truth, dare, submit, question).
- `src/interactions/` - Button and modal handlers for user interactions.
- `src/services/` - Business logic for questions, submissions, approvals, and similarity checking.
- `src/handlers/` - Command and button loader modules.
- `src/database/` - Database client and connection management.
- `src/config/` - Environment configuration.
- `src/utils/` - Utilities including ID generation, logging, rate limiting, permissions, sanitization, and caching.
- `data/` - Default location for the SQLite database file.

## Development Notes

- Commands are loaded from the top level of `src/commands/` directory.
- Button handlers are loaded from `src/interactions/buttons/` directory.
- Modal handlers are defined in `src/interactions/modals/` directory.
- Question rotation walks through each list sequentially and loops back to the start.
- All question IDs are 8-character uppercase alphanumeric strings.
- The project is written in TypeScript and compiled to JavaScript before running.

## Security

This bot implements comprehensive security measures:

- **Input Validation**: All user inputs are sanitized and validated
- **SQL Injection Prevention**: Prepared statements for all database operations
- **Rate Limiting**: Protection against spam and abuse
- **Access Control**: Role-based permissions for administrative commands
- **Secure Token Storage**: Environment variables for sensitive configuration
- **Automated Security**: CodeQL scanning and Dependabot updates

For security concerns or to report vulnerabilities, please see our [Security Policy](SECURITY.md).

For detailed security implementation information, see [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md).
