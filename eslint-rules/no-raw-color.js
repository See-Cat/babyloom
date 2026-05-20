'use strict';

const RAW_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;

function isCheckedFile(filename) {
  return /\/(app|components)\//.test(filename) && /\.(ts|tsx|js|jsx)$/.test(filename);
}

function checkText(context, node, text) {
  if (typeof text !== 'string') return;
  if (!RAW_COLOR_PATTERN.test(text)) return;
  if (isThemeColorMetaContent(node)) return;

  context.report({
    node,
    messageId: 'rawColor'
  });
}

function isThemeColorMetaContent(node) {
  const attr = node.parent;
  const opening = attr?.parent;
  if (attr?.type !== 'JSXAttribute' || attr.name?.name !== 'content') return false;
  if (opening?.type !== 'JSXOpeningElement' || opening.name?.name !== 'meta') return false;
  return opening.attributes.some((candidate) => (
    candidate.type === 'JSXAttribute' &&
    candidate.name?.name === 'name' &&
    candidate.value?.type === 'Literal' &&
    candidate.value.value === 'theme-color'
  ));
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
