import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FamilyMemberList, type FamilyMemberListItem } from './FamilyMemberList';

const noop = () => {};

function member(overrides: Partial<FamilyMemberListItem> = {}): FamilyMemberListItem {
  return {
    memberId: 'm1',
    userId: 'u1',
    username: 'grandpa',
    nickname: 'Grandpa',
    role: 'member',
    babyPermissions: [],
    ...overrides
  };
}

describe('FamilyMemberList', () => {
  it('renders baby permission rows with localized labels', () => {
    const html = renderToStaticMarkup(
      <FamilyMemberList
        members={[
          member({
            babyPermissions: [
              { babyId: 'b1', babyName: 'Big Bro', babyAvatarUrl: null, permission: 'editor' },
              { babyId: 'b2', babyName: 'Sis', babyAvatarUrl: null, permission: 'viewer' }
            ]
          })
        ]}
        onMemberAction={noop}
        onAssociationClick={noop}
        onAddAssociation={noop}
      />
    );

    expect(html).toContain('Big Bro');
    expect(html).toContain('Sis');
    expect(html).toContain('可编辑');
    expect(html).toContain('仅查看');
  });

  it('shows "+ 关联宝宝" button for members with zero associations', () => {
    const html = renderToStaticMarkup(
      <FamilyMemberList
        members={[member()]}
        onMemberAction={noop}
        onAssociationClick={noop}
        onAddAssociation={noop}
      />
    );

    expect(html).toContain('+ 关联宝宝');
  });

  it('disables "+ 关联宝宝" and shows the reason when canAddDisabledReason returns text', () => {
    const html = renderToStaticMarkup(
      <FamilyMemberList
        members={[member()]}
        onMemberAction={noop}
        onAssociationClick={noop}
        onAddAssociation={noop}
        canAddDisabledReason={() => '请先在「宝宝管理」中添加宝宝'}
      />
    );

    expect(html).toContain('disabled');
    expect(html).toContain('请先在「宝宝管理」中添加宝宝');
  });

  it('exposes the more-actions trigger with an accessible label', () => {
    const html = renderToStaticMarkup(
      <FamilyMemberList
        members={[member()]}
        onMemberAction={noop}
        onAssociationClick={noop}
        onAddAssociation={noop}
      />
    );

    expect(html).toContain('aria-label="更多操作"');
  });

  it('renders nothing when members list is empty', () => {
    const html = renderToStaticMarkup(
      <FamilyMemberList
        members={[]}
        onMemberAction={noop}
        onAssociationClick={noop}
        onAddAssociation={noop}
      />
    );

    expect(html).toBe('<ul class="flex flex-col gap-[var(--space-3)]"></ul>');
  });
});
