const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const generateId = (length) => {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * ALPHANUMERIC.length);
    result += ALPHANUMERIC[index];
  }
  return result;
};

const generateQuestionId = () => generateId(8);
const generateSubmissionId = () => generateId(6);

module.exports = {
  generateQuestionId,
  generateSubmissionId,
};
