'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/mobile/AppShell';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Tag } from '@/components/ui/Tag';
import { ChevronLeftIcon, PlusIcon } from '@/components/ui/icons';
import { cn } from '@/lib/shared/cn';

interface Milestone {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  isSystem: boolean;
}

export default function MilestonesAdminPage() {
  const [items, setItems] = useState<Milestone[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [removeFor, setRemoveFor] = useState<Milestone | null>(null);

  async function reload() {
    const res = await fetch('/api/milestones');
    if (!res.ok) return;
    const body = await res.json();
    setItems(body.milestones);
  }

  useEffect(() => {
    reload();
  }, []);

  async function create(name: string) {
    const trimmed = name.trim();
    setCreating(false);
    if (!trimmed) return;
    await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed, icon: 'custom' })
    });
    reload();
  }

  async function remove(id: string) {
    await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    setRemoveFor(null);
    reload();
  }

  async function saveEdit(id: string, name: string) {
    const trimmed = name.trim();
    setEditingId(null);
    const original = items.find((m) => m.id === id)?.name ?? '';
    if (!trimmed || trimmed === original) return;
    await fetch(`/api/milestones/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed })
    });
    reload();
  }

  return (
    <AppShell
      title="里程碑设置"
      leftSlot={
        <Link
          href="/profile"
          aria-label="返回"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-[color:var(--color-fg)] active:bg-black/5"
        >
          <ChevronLeftIcon />
        </Link>
      }
    >
      <p className="mb-[var(--space-3)] px-[var(--space-1)] text-[length:var(--text-xs)] text-[color:var(--color-fg-soft)]">
        点击标签可编辑名称,点击 × 可删除。
      </p>
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        {items.map((m) =>
          editingId === m.id ? (
            <InlineTagInput
              key={m.id}
              initialValue={m.name}
              variant="accent"
              onCommit={(value) => saveEdit(m.id, value)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <Tag
              key={m.id}
              variant="accent"
              removable
              onRemove={(event) => {
                event.stopPropagation();
                setRemoveFor(m);
              }}
              onClick={() => setEditingId(m.id)}
              className="cursor-pointer select-none"
            >
              {m.name}
            </Tag>
          )
        )}
        {creating ? (
          <InlineTagInput
            initialValue=""
            placeholder="新里程碑"
            variant="dashed"
            onCommit={create}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-[4px] rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-border)] px-[10px] py-[4px] text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)] active:translate-y-[1px]"
          >
            <PlusIcon className="h-3 w-3" /> 添加
          </button>
        )}
      </div>

      <Modal
        open={Boolean(removeFor)}
        onOpenChange={(open) => {
          if (!open) setRemoveFor(null);
        }}
        title="删除里程碑"
        dismissible={false}
        footer={
          <>
            <Button type="button" variant="default" onClick={() => setRemoveFor(null)}>
              取消
            </Button>
            <Button type="button" variant="error" onClick={() => removeFor && remove(removeFor.id)}>
              删除
            </Button>
          </>
        }
      >
        <p className="text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-fg)]">
          确认删除 {removeFor?.name ?? '该里程碑'}? 已挂在记录上的会断开关联,不会删除记录。
        </p>
      </Modal>
    </AppShell>
  );
}

interface InlineTagInputProps {
  initialValue: string;
  placeholder?: string;
  variant: 'accent' | 'dashed';
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function InlineTagInput({ initialValue, placeholder, variant, onCommit, onCancel }: InlineTagInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit() {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(value);
  }

  return (
    <span
      className={cn(
        'inline-flex items-center transition-shadow focus-within:[box-shadow:var(--shadow-focus)]',
        variant === 'dashed'
          ? 'rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-border)] bg-transparent px-[10px] py-[4px]'
          : 'tag accent'
      )}
      data-variant={variant}
    >
      <input
        ref={inputRef}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            committedRef.current = true;
            onCancel();
          }
        }}
        onBlur={commit}
        className="tag-bare-input appearance-none border-0 bg-transparent p-0 text-[length:var(--text-sm)] font-semibold leading-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none placeholder:text-[color:var(--color-fg-soft)]"
        style={{ color: 'inherit', fieldSizing: 'content', minWidth: '4ch', boxShadow: 'none' } as CSSProperties}
      />
    </span>
  );
}
