/**
 * Permission helper utilities for evaluating privileged member access.
 *
 * @module src/utils/permissions
 */

import { PermissionFlagsBits, GuildMember } from 'discord.js';

/**
 * Determines whether a guild member has one of the privileged roles or administrator rights.
 *
 * @param member - Member to inspect.
 * @param allowedRoleIds - Collection of role IDs that grant access.
 * @returns True if the member may perform privileged actions.
 */
export const hasPrivilegedRole = (member: GuildMember | null, allowedRoleIds: string[] = []): boolean => {
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
