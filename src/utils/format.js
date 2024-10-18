const codeBlockRegex = /\`\`\`([^\`\`\`]*\n[^\`\`\`]*)\`\`\`/g;

export const splitParagraphs = (str) => {
  // change double break line of codeblocks to exclude them on the split process
  str = str.replace(codeBlockRegex, (match) => match.replace(/\n\n/g, "\n \n"));
  return str.split(`\n\n`);
};
