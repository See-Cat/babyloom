import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';

const rule = require('./parent-chain-join');

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  }
});

const schemaImport = `import { babies, entries, media, familyMembers } from '@/lib/server/db/schema';`;
const filename = '/repo/app/api/example/route.ts';

describe('babyloom/parent-chain-join', () => {
  it('requires entries/media queries to join babies', () => {
    tester.run('parent-chain-join', rule as any, {
      valid: [
        {
          filename,
          code: `${schemaImport}
db.select().from(entries).innerJoin(babies, eq(babies.id, entries.babyId));`
        },
        {
          filename,
          code: `${schemaImport}
db.select().from(media).innerJoin(babies, eq(babies.id, media.babyId)).leftJoin(users, eq(users.id, media.deletedBy));`
        },
        {
          filename,
          code: `${schemaImport}
// PARENT-CHAIN-EXEMPT: count-only aggregation
db.select({ count: sql\`count(*)\` }).from(media);`
        },
        {
          filename,
          code: `${schemaImport}
db.select().from(babies);`
        }
      ],
      invalid: [
        {
          filename,
          code: `${schemaImport}
db.select().from(entries).where(eq(entries.status, 'active'));`,
          errors: [{ messageId: 'missingParentChainJoin' }]
        },
        {
          filename,
          code: `${schemaImport}
db.select().from(babies).innerJoin(media, eq(media.babyId, babies.id));
db.select().from(media).where(eq(media.status, 'ready'));`,
          errors: [{ messageId: 'missingParentChainJoin' }]
        },
        {
          filename,
          code: `${schemaImport}
// PARENT-CHAIN-EXEMPT:
db.select().from(entries);`,
          errors: [{ messageId: 'missingParentChainJoin' }]
        },
        {
          filename,
          code: `${schemaImport}
db.select().from(media).innerJoin(familyMembers, eq(familyMembers.familyId, babies.familyId));`,
          errors: [{ messageId: 'missingParentChainJoin' }]
        }
      ]
    });
  });
});
