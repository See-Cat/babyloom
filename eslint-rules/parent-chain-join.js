'use strict';

function isSchemaImport(node) {
  return node.source && node.source.value === '@/lib/server/db/schema';
}

function propertyName(member) {
  return member.property && member.property.type === 'Identifier' ? member.property.name : null;
}

function isFromCall(node) {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    propertyName(node.callee) === 'from'
  );
}

function hasNonEmptyExemption(context, node) {
  const sourceCode = context.sourceCode;
  const comments = sourceCode.getCommentsBefore(node);
  const nodeLine = node.loc.start.line;
  return comments.some((comment) => {
    const sameOrPreviousLine = comment.loc.end.line === nodeLine || comment.loc.end.line === nodeLine - 1;
    if (!sameOrPreviousLine) return false;
    const match = comment.value.match(/PARENT-CHAIN-EXEMPT:\s*(.+)$/);
    return Boolean(match && match[1].trim());
  });
}

function hasBabiesJoin(fromCall, babiesNames) {
  let current = fromCall.parent;
  while (current) {
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'MemberExpression' &&
      (propertyName(current.callee) === 'innerJoin' || propertyName(current.callee) === 'leftJoin')
    ) {
      const firstArg = current.arguments[0];
      if (firstArg && firstArg.type === 'Identifier' && babiesNames.has(firstArg.name)) return true;
    }

    if (
      current.type !== 'MemberExpression' &&
      current.type !== 'CallExpression' &&
      current.type !== 'ChainExpression'
    ) {
      break;
    }
    current = current.parent;
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require entries/media queries to join babies for parent-chain visibility.'
    },
    messages: {
      missingParentChainJoin:
        'Queries starting from "{{table}}" must join babies or include a non-empty PARENT-CHAIN-EXEMPT reason.'
    },
    schema: []
  },
  create(context) {
    const filename = context.getFilename();
    if (/\/tests\//.test(filename)) return {};
    if (!/\/app\//.test(filename) && !/\/lib\/db\/queries\//.test(filename)) return {};

    const tableNames = new Set();
    const babiesNames = new Set();

    return {
      ImportDeclaration(node) {
        if (!isSchemaImport(node)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue;
          const imported =
            specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value;
          if (imported === 'entries' || imported === 'media') tableNames.add(specifier.local.name);
          if (imported === 'babies') babiesNames.add(specifier.local.name);
        }
      },

      CallExpression(node) {
        if (!isFromCall(node)) return;
        const table = node.arguments[0];
        if (!table || table.type !== 'Identifier' || !tableNames.has(table.name)) return;
        if (hasBabiesJoin(node, babiesNames)) return;
        if (hasNonEmptyExemption(context, node)) return;

        context.report({
          node: table,
          messageId: 'missingParentChainJoin',
          data: { table: table.name }
        });
      }
    };
  }
};
