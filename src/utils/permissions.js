const { PermissionFlagsBits } = require('discord.js');

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
