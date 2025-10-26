# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of tod-bot seriously. If you have discovered a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing the repository maintainers or by using GitHub's private vulnerability reporting feature:

1. Go to the repository's **Security** tab
2. Click on **Report a vulnerability**
3. Fill in the details of the vulnerability

Alternatively, you can create a private security advisory by visiting:
`https://github.com/WorksLocally/tod-bot/security/advisories/new`

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Any suggested fixes (optional)
- Your contact information for follow-up

### Response Timeline

- **Initial Response**: Within 48 hours of report
- **Status Update**: Within 7 days with initial assessment
- **Fix Timeline**: Varies based on severity and complexity
  - Critical: Within 7 days
  - High: Within 30 days
  - Medium: Within 60 days
  - Low: Within 90 days

### Security Update Process

1. Vulnerability is reported and acknowledged
2. Issue is confirmed and assessed for severity
3. Patch is developed and tested
4. Security advisory is prepared
5. Patch is released with security advisory
6. Reporter is credited (if desired)

## Security Best Practices

### For Contributors

When contributing to this project, please ensure:

1. **No Secrets in Code**: Never commit secrets, tokens, or credentials
2. **Input Validation**: Always validate and sanitize user inputs
3. **SQL Safety**: Use prepared statements for all database queries
4. **Dependency Updates**: Keep dependencies up to date
5. **Error Handling**: Don't expose sensitive information in error messages
6. **Logging**: Avoid logging sensitive data (tokens, passwords, etc.)

### For Self-Hosting Users

If you're self-hosting this bot, we recommend:

1. **Environment Variables**: Store all sensitive configuration in `.env` files
2. **File Permissions**: Secure your `.env` file with appropriate permissions (chmod 600)
3. **Database Security**: Keep your SQLite database file secure and backed up
4. **Regular Updates**: Keep your bot updated with the latest security patches
5. **Access Control**: Limit bot permissions to only what's necessary
6. **Log Monitoring**: Regularly review logs for suspicious activity
7. **Network Security**: Use firewalls and proper network segmentation
8. **Token Security**: Rotate Discord bot tokens if compromised

### Discord Bot Permissions

This bot requires the following permissions:
- `Send Messages`: To respond to commands
- `Manage Messages`: To handle reactions on approval messages
- `Read Message History`: To fetch and update approval messages
- `Use External Emojis`: For better user experience
- `Add Reactions`: For approval workflow

**Principle of Least Privilege**: Only grant the minimum permissions required for the bot to function.

## Security Features

### Current Security Measures

1. **Input Sanitization**: All user inputs are sanitized using the `sanitizeText` utility
2. **SQL Injection Prevention**: Prepared statements are used for all database operations
3. **Permission Checks**: Role-based access control for administrative commands
4. **Rate Limiting**: Discord's built-in rate limiting protects against spam
5. **Secure ID Generation**: Cryptographically secure random ID generation
6. **Environment Isolation**: Configuration via environment variables
7. **Dependency Scanning**: Automated dependency updates via Dependabot
8. **Code Scanning**: CodeQL analysis for vulnerability detection
9. **Error Handling**: Comprehensive error handling without information leakage

### Authentication & Authorization

- Bot token authentication via Discord API
- Role-based access control (Admin, Moderator, Question Master)
- Permission validation on all privileged operations
- Guild-specific command deployment for isolation

### Data Protection

- SQLite database with WAL mode for data integrity
- No storage of sensitive user data beyond Discord IDs
- Automatic database schema migrations
- Foreign key constraints enabled

## Known Security Considerations

### Rate Limiting

The bot relies on Discord's built-in rate limiting. For additional protection:
- Users can submit questions, but moderators must approve them
- Administrative commands require privileged roles
- Commands are guild-specific, not global

### Error Messages

Error messages are designed to be informative without revealing system details:
- Generic error messages for users
- Detailed logging for administrators (in log files only)
- No stack traces exposed to end users

### Token Security

The Discord bot token is the primary security credential:
- Must be stored in `.env` file (never in code)
- Should be regenerated if exposed
- Access to the host system = access to the bot

## Compliance

This project:
- Follows Discord's Terms of Service and Developer Terms
- Implements data handling best practices
- Provides transparency in data usage
- Respects user privacy

## Security Audit History

| Date       | Type          | Findings | Status   |
|------------|---------------|----------|----------|
| 2025-10-26 | Deep Dive     | Minor    | Resolved |

## Contact

For security concerns, please refer to the reporting process above. For general questions about security, you can open a public discussion in the repository.

## Acknowledgments

We thank all security researchers who responsibly disclose vulnerabilities to help keep this project secure.
