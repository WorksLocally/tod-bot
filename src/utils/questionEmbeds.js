const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TYPE_LABELS = {
  truth: { label: 'Truth', color: 0x2ecc71 },
  dare: { label: 'Dare', color: 0xe67e22 },
};

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
    embed.setAuthor({
      name: `Requested by ${requestedBy.displayName}`,
      iconURL: requestedBy.displayAvatarURL?.() ?? undefined,
    });
  }

  return embed;
};

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
