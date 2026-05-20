'use strict';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const ALLOWED_WRAPPERS = new Set([
  'withAuthorizedResource',
  'withAuthorizedAction',
  'withAuthorizedActionRoute'
]);
const EXEMPT_FILES = new Set([
  '/app/api/entries/[id]/media/[mediaId]/attach/route.ts',
  '/app/api/log/client/route.ts'
]);

// Walk a CallExpression's callee chain to find the leftmost Identifier.
//   withAuthorizedResource({...})(handler)
//     → CallExpression( callee: CallExpression( callee: Identifier 'withAuthorizedResource' ) )
function leftmostCalleeName(node) {
  let current = node;
  while (current && current.type === 'CallExpression') {
    current = current.callee;
  }
  return current && current.type === 'Identifier' ? current.name : null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Every app/api/**/route.ts HTTP-method export must use an authorized route wrapper — no other shape allowed.'
    },
    messages: {
      notWrapped:
        'API route export "{{name}}" must be exported as `export const {{name}} = withAuthorizedResource(...)(handler)` OR `withAuthorizedAction(...)(handler)`. Direct function exports or other initializers are forbidden (spec §5.7).'
    },
    schema: []
  },
  create(context) {
    const filename = context.getFilename();
    const isApiRoute = /\/app\/api\/.*\/route\.(ts|tsx|js|jsx)$/.test(filename);
    if (!isApiRoute) return {};

    // Allowlist: better-auth's own catch-all, and the public health endpoint
    if (/\/app\/api\/auth\/\[\.\.\.all\]\/route\.(ts|tsx|js|jsx)$/.test(filename)) return {};
    if (/\/app\/api\/health\/route\.(ts|tsx|js|jsx)$/.test(filename)) return {};
    if ([...EXEMPT_FILES].some((path) => filename.endsWith(path))) return {};

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;

        // ─── Case A: `export specifier` form (Codex round-12 finding #2) ───
        // Covers `const GET = ...; export { GET };` and re-exports.
        // This shape has decl===null and specifiers!==[]. Reject any HTTP
        // method name appearing as an exported specifier — the only legal
        // route shape is a direct `export const METHOD = wrapper(...)(...)`.
        if (!decl) {
          for (const spec of node.specifiers ?? []) {
            // ExportSpecifier: { type, local: Identifier, exported: Identifier }
            const exportedName =
              spec?.exported?.type === 'Identifier' ? spec.exported.name : null;
            if (exportedName && HTTP_METHODS.has(exportedName)) {
              context.report({ node: spec, messageId: 'notWrapped', data: { name: exportedName } });
            }
          }
          return;
        }

        // ─── Case B: `export async function GET(){}` ──────────────────────
        if (decl.type === 'FunctionDeclaration') {
          const name = decl.id?.name;
          if (name && HTTP_METHODS.has(name)) {
            context.report({ node, messageId: 'notWrapped', data: { name } });
          }
          return;
        }

        // ─── Case C: `export const GET = withAuthorizedResource(...)(...)` ─
        if (decl.type !== 'VariableDeclaration') return;

        for (const d of decl.declarations) {
          const name = d.id?.type === 'Identifier' ? d.id.name : null;
          if (!name || !HTTP_METHODS.has(name)) continue;

          const init = d.init;
          const ok =
            init &&
            init.type === 'CallExpression' &&
            ALLOWED_WRAPPERS.has(leftmostCalleeName(init));

          if (!ok) {
            context.report({ node: d, messageId: 'notWrapped', data: { name } });
          }
        }
      },

      // Belt-and-suspenders: also reject `export default` for HTTP methods
      // (Next.js doesn't accept these for route methods, but defense in depth).
      ExportDefaultDeclaration() {
        // Default exports cannot be HTTP method handlers in App Router; ignore
        // to avoid false positives in non-route files matching the path glob.
      }
    };
  }
};
