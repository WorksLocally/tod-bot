/**
 * Utilities for building embeds and components that present truth or dare questions.
 *
 * @module src/utils/questionEmbeds
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TYPE_LABELS = {
  truth: { label: 'Truth', color: 0x2ecc71 },
  dare: { label: 'Dare', color: 0xe67e22 },
};

/**
 * Determines a human-friendly display name for a guild member or user.
 *
 * @param {import('discord.js').GuildMember | import('discord.js').User | undefined} entity - The requesting entity.
 * @returns {string | null} - Preferred display name or null when unavailable.
 */
const resolveDisplayName = (entity) => {
  if (!entity) {
    return null;
  }

  if (typeof entity.displayName === 'string' && entity.displayName.trim().length) {
    return entity.displayName;
  }

  if ('nickname' in entity && typeof entity.nickname === 'string' && entity.nickname.trim().length) {
    return entity.nickname;
  }

  if (typeof entity.globalName === 'string' && entity.globalName.trim().length) {
    return entity.globalName;
  }

  if (typeof entity.username === 'string' && entity.username.trim().length) {
    return entity.username;
  }

  if ('user' in entity && entity.user) {
    const user = entity.user;
    if (typeof user.globalName === 'string' && user.globalName.trim().length) {
      return user.globalName;
    }
    if (typeof user.username === 'string' && user.username.trim().length) {
      return user.username;
    }
    if (typeof user.tag === 'string' && user.tag.trim().length) {
      return user.tag;
    }
  }

  if (typeof entity.tag === 'string' && entity.tag.trim().length) {
    return entity.tag;
  }

  return null;
};

/**
 * Creates the embed describing the current question.
 *
 * @param {Object} options - Options used to build the embed.
 * @param {{ question_id: string, text: string, type: 'truth' | 'dare' }} options.question - Question data.
 * @param {import('discord.js').GuildMember | import('discord.js').User} [options.requestedBy] - Requesting user.
 * @returns {EmbedBuilder} - Configured embed instance.
 */
const buildQuestionEmbed = ({ question, requestedBy }) => {
  const typeMeta = TYPE_LABELS[question.type] ?? TYPE_LABELS.truth;

  const embed = new EmbedBuilder()
    .setTitle(`${typeMeta.label} Question`)
    .setDescription(question.text)
    .setColor(typeMeta.color)
    .setFooter({
      text: `ID: ${question.question_id}`,
    })
    .setTimestamp(new Date());

  if (requestedBy) {
    const displayName = resolveDisplayName(requestedBy);
    if (displayName) {
      embed.setAuthor({
        name: `Requested by ${displayName}`,
        iconURL: requestedBy.displayAvatarURL?.() ?? undefined,
      });
    }
  }

  return embed;
};

/**
 * Builds the action row containing Truth and Dare buttons.
 *
 * @returns {ActionRowBuilder<ButtonBuilder>[]} - Action row with interactive buttons.
 */
const buildQuestionComponents = () => {
  const truthButton = new ButtonBuilder()
    .setCustomId('question_truth_next')
    .setLabel('Truth')
    .setStyle(ButtonStyle.Primary);

  const dareButton = new ButtonBuilder()
    .setCustomId('question_dare_next')
    .setLabel('Dare')
    .setStyle(ButtonStyle.Danger);

  return [new ActionRowBuilder().addComponents(truthButton, dareButton)];
};

module.exports = {
  buildQuestionEmbed,
  buildQuestionComponents,
};
