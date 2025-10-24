/**
 * Permission helper utilities for evaluating privileged member access.
 *
 * @module src/utils/permissions
 */

const { PermissionFlagsBits } = require('discord.js');

/**
 * Determines whether a guild member has one of the privileged roles or administrator rights.
 *
 * @param {import('discord.js').GuildMember | null} member - Member to inspect.
 * @param {string[]} allowedRoleIds - Collection of role IDs that grant access.
 * @returns {boolean} - True if the member may perform privileged actions.
 */
const hasPrivilegedRole = (member, allowedRoleIds = []) => {
  if (!member) {
    return false;
  }

  if (member.permissions?.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  const roleSet = new Set(allowedRoleIds.filter(Boolean));
  if (!roleSet.size) {
    return false;
  }

  return member.roles.cache.some((role) => roleSet.has(role.id));
};

module.exports = {
  hasPrivilegedRole,
};
