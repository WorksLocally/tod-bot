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
- `/submit` - Users submit questions for moderator approval. Posts to the configured channel with pending status.

### Moderator Commands (`/question`)

- `add` - Add a question directly or approve a submission (`submission-id` optional). Assigns an 8-character ID and updates approval status.
- `delete` - Remove a question by ID.
- `edit` - Update the text of a question.
- `list` - Show all questions (optionally filtered by type).
- `view` - Show question details by ID.
- `reject` - Reject a pending submission, update the approval message, and DM the submitter.

## Approval Workflow

1. `/submit` records the request and posts an embed with a check-mark reaction.
2. Moderators run `/question add submission-id:XXXXXX` to approve, which:
   - Assigns an ID, appends to the rotation list, updates the embed, swaps the reaction to a check mark, and DMs the submitter.
3. `/question reject` swaps the reaction to a cross mark and DMs the submitter with the optional reason.

## Project Structure

- `src/index.js` - Discord client bootstrap.
- `src/commands/` - Slash command handlers split by feature.
- `src/services/` - Database operations, approval notifications, rotation logic.
- `src/utils/` - ID generation, embeds, permission helpers.
- `data/` - Default location for the SQLite database file.

## Development Notes

- Commands and interactions are hot-loaded from their respective folders.
- Question rotation walks through each list sequentially and loops back to the start.
- All question IDs are 8-character uppercase alphanumeric strings.

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
