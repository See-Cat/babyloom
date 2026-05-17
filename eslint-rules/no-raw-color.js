'use strict';

const RAW_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;

function isCheckedFile(filename) {
  return /\/(app|components)\//.test(filename) && /\.(ts|tsx|js|jsx)$/.test(filename);
}

function checkText(context, node, text) {
  if (typeof text !== 'string') return;
  if (!RAW_COLOR_PATTERN.test(text)) return;

  context.report({
    node,
    messageId: 'rawColor'
  });
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow raw hex/rgb colors in app and component source.'
    },
    messages: {
      rawColor: 'Use design tokens such as `var(--color-*)` instead of raw hex/rgb colors.'
    },
    schema: []
  },
  create(context) {
    const filename = context.getFilename();
    if (!isCheckedFile(filename)) return {};

    return {
      Literal(node) {
        checkText(context, node, node.value);
      },
      TemplateElement(node) {
        checkText(context, node, node.value.raw);
      }
    };
  }
};
