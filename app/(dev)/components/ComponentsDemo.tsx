'use client';

import * as React from 'react';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Collapse } from '@/components/ui/Collapse';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { Tag } from '@/components/ui/Tag';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/lib/hooks/useToast';

export function ComponentsDemo() {
  const [enabled, setEnabled] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [collapseOpen, setCollapseOpen] = React.useState(true);
  const toast = useToast();

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-[var(--space-4)] py-[var(--space-8)] text-[var(--color-fg)]">
      <div className="mx-auto grid max-w-5xl gap-[var(--space-4)] sm:grid-cols-2">
        <Card>
          <h1 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Button</h1>
          <div className="flex flex-wrap gap-[var(--space-3)]">
            <Button>主要</Button>
            <Button variant="secondary">次要</Button>
            <Button variant="ghost">轻量</Button>
            <Button loading>保存中</Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Input</h2>
          <div className="flex flex-col gap-[var(--space-3)]">
            <Input label="宝宝名字" placeholder="小米" />
            <Input label="错误状态" error="请输入宝宝名字" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Textarea</h2>
          <Textarea label="记录内容" placeholder="今天第一次翻身了" />
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Switch</h2>
          <Switch checked={enabled} aria-label="启用提醒" onCheckedChange={setEnabled} />
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Tag</h2>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Tag>普通</Tag>
            <Tag variant="accent">高亮</Tag>
            <Tag variant="error" removable onRemove={() => undefined}>
              移除
            </Tag>
          </div>
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Avatar</h2>
          <div className="flex items-center gap-[var(--space-4)]">
            <Avatar name="小米" alt="小米" />
            <AvatarGroup avatars={[{ name: 'Ava', alt: 'Ava' }, { name: 'Ben', alt: 'Ben' }, { name: '小米', alt: '小米' }, { name: 'Dan', alt: 'Dan' }]} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Spinner</h2>
          <Spinner />
        </Card>

        <Card interactive>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Card</h2>
          <p>可交互卡片</p>
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Dialog</h2>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            打开 Dialog
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="确认操作"
            description="桌面端显示 Modal，移动端显示 BottomSheet。"
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={() => setDialogOpen(false)}>确认</Button>
              </>
            }
          >
            <p>这里是对话框内容。</p>
          </Dialog>
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Toast</h2>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button variant="secondary" onClick={() => toast.show({ message: '已保存' })}>
              普通 Toast
            </Button>
            <Button variant="success" onClick={() => toast.show({ message: '保存成功', variant: 'success' })}>
              成功 Toast
            </Button>
            <Button variant="error" onClick={() => toast.show({ message: '删除失败', variant: 'error', action: { label: '重试', onClick: () => undefined } })}>
              错误 Toast
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-[var(--space-3)] text-[var(--text-xl)] font-bold">Collapse</h2>
          <Button variant="secondary" onClick={() => setCollapseOpen((value) => !value)}>
            切换
          </Button>
          <Collapse open={collapseOpen} className="mt-[var(--space-3)]">
            <p>折叠内容</p>
          </Collapse>
        </Card>
      </div>
    </main>
  );
}
