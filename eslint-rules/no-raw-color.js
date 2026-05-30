'use strict';

const path = require('node:path');

const RAW_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/;

// Resolve the file path relative to the ESLint working directory so the
// source-dir check matches real project layout (e.g. "app/...") instead of
// coincidental segments in the absolute path such as a "/app" container WORKDIR.
function relativeSourcePath(context) {
  const filename = context.filename || context.getFilename();
  if (!filename || filename[0] === '<') return '';
  const cwd = context.cwd || (context.getCwd && context.getCwd()) || process.cwd();
  const rel = path.isAbsolute(filename) ? path.relative(cwd, filename) : filename;
  return rel.split(path.sep).join('/');
}

function isCheckedFile(rel) {
  return /^(app|components)\//.test(rel) && /\.(ts|tsx|js|jsx)$/.test(rel);
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
    if (!isCheckedFile(relativeSourcePath(context))) return {};

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
