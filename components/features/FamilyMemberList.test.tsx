import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FamilyMemberList } from './FamilyMemberList';

describe('FamilyMemberList', () => {
  it('renders role badges and chevrons for manageable members', () => {
    const html = renderToStaticMarkup(
      <FamilyMemberList
        members={[
          member('owner-1', '妈妈', 'mama', 'owner'),
          member('editor-1', '爸爸', 'baba', 'editor')
        ]}
      />
    );

    expect(html).toContain('主理人');
    expect(html).toContain('家庭记录员');
    expect(html).toContain('<svg');
    expect(html).not.toContain('›');
    expect(html).not.toContain('confirm(');
  });
});

function member(userId: string, nickname: string, username: string, role: 'owner' | 'editor' | 'viewer') {
  return {
    memberId: `${userId}-member`,
    userId,
    username,
    nickname,
    role
  };
}
