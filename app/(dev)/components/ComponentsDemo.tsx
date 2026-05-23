'use client';

import * as React from 'react';
import { ActionSheet } from '@/components/mobile/ActionSheet';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { Tabbar } from '@/components/mobile/Tabbar';
import { Avatar, AvatarGroup } from '@/components/ui/Avatar';
import { AvatarPicker } from '@/components/ui/AvatarPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Collapse } from '@/components/ui/Collapse';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Spinner } from '@/components/ui/Spinner';
import { Switch } from '@/components/ui/Switch';
import { Tag } from '@/components/ui/Tag';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/lib/hooks/useToast';

const avatars = [
  { name: 'Ava', alt: 'Ava', colorKey: 'ava' },
  { name: 'Ben', alt: 'Ben', colorKey: 'ben' },
  { name: '小米', alt: '小米', colorKey: 'xiaomi' },
  { name: 'Dan', alt: 'Dan', colorKey: 'dan' }
];

export function ComponentsDemo() {
  const [enabled, setEnabled] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [actionOpen, setActionOpen] = React.useState(false);
  const [collapseOpen, setCollapseOpen] = React.useState(true);
  const [date, setDate] = React.useState('2024-08-01');
  const [segment, setSegment] = React.useState('week');
  const toast = useToast();

  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-[var(--space-4)] pb-[calc(96px+env(safe-area-inset-bottom))] pt-[var(--space-8)] text-[color:var(--color-fg)]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-[var(--space-7)]">
          <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[color:var(--color-fg-soft)]">Tokens</p>
          <h1 className="text-[length:var(--text-2xl)] font-bold leading-[var(--leading-tight)] text-[color:var(--color-fg-strong)]">
            Babyloom 通用组件测试页
          </h1>
        </header>

        <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
          <DemoSection title="Button">
            <div className="flex flex-wrap items-center gap-[var(--space-3)]">
              <Button size="sm">主要</Button>
              <Button variant="default">默认</Button>
              <Button size="lg">大型</Button>
              <Button variant="danger">删除</Button>
              <Button variant="ghost-primary">描边</Button>
              <Button variant="text">文字</Button>
              <Button variant="link">链接</Button>
              <Button loading>保存中</Button>
              <Button className="h-14 w-14 px-0" aria-label="FAB">
                <PlusIcon />
              </Button>
              <span className="text-[length:var(--text-sm)] font-bold text-[color:var(--color-fg-soft)]">FAB</span>
            </div>
          </DemoSection>

          <DemoSection title="Input">
            <div className="grid gap-[var(--space-3)]">
              <Input label="宝宝名字" placeholder="小米" leadingSlot={<UserIcon />} />
              <Input label="错误状态" error="请输入宝宝名字" />
            </div>
          </DemoSection>

          <DemoSection title="Textarea">
            <Textarea label="记录内容" placeholder="今天第一次翻身了" />
          </DemoSection>

          <DemoSection title="Switch">
            <div className="flex items-center gap-[var(--space-3)]">
              <Switch checked={enabled} aria-label="启用提醒" onCheckedChange={setEnabled} />
              <span className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">
                {enabled ? '已开启' : '已关闭'}
              </span>
            </div>
          </DemoSection>

          <DemoSection title="Tag">
            <div className="flex flex-wrap gap-[var(--space-2)]">
              <Tag>普通</Tag>
              <Tag variant="accent">高亮</Tag>
              <Tag variant="error" removable onRemove={() => undefined}>
                移除
              </Tag>
            </div>
          </DemoSection>

          <DemoSection title="Avatar">
            <div className="flex flex-wrap items-center gap-[var(--space-4)]">
              <Avatar name="小米" size="xs" colorKey="baby-xs" />
              <Avatar name="小米" size="sm" colorKey="baby-sm" />
              <Avatar name="小米" size="md" colorKey="baby-md" />
              <Avatar name="小米" size="lg" colorKey="baby-lg" />
              <Avatar name="小米" size="xl" colorKey="baby-xl" />
              <AvatarGroup avatars={avatars} />
            </div>
          </DemoSection>

          <DemoSection title="AvatarPicker">
            <AvatarPicker name="小米" colorKey="baby-picker" hint="头像可选 · 不上传时自动用昵称首字" />
          </DemoSection>

          <DemoSection title="Card">
            <div className="grid gap-[var(--space-3)] sm:grid-cols-3">
              <Card>默认 Card</Card>
              <Card variant="dashed">Dashed Card</Card>
              <Card variant="tinted" tint="pink">Tinted Card</Card>
            </div>
          </DemoSection>

          <DemoSection title="SegmentedControl">
            <SegmentedControl
              ariaLabel="查看范围"
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'day', label: '今天' },
                { value: 'week', label: '本周' },
                { value: 'month', label: '本月' }
              ]}
            />
          </DemoSection>

          <DemoSection title="Spinner">
            <div className="flex items-center gap-[var(--space-4)]">
              <Spinner />
              <Button variant="default" loading>
                加载中
              </Button>
            </div>
          </DemoSection>

          <DemoSection title="Toast">
            <div className="flex flex-wrap gap-[var(--space-2)]">
              <Button variant="default" onClick={() => toast.show({ message: '已保存' })}>
                普通 Toast
              </Button>
              <Button variant="success" onClick={() => toast.show({ message: '保存成功', variant: 'success' })}>
                成功 Toast
              </Button>
              <Button variant="danger" onClick={() => toast.show({ message: '删除失败', variant: 'error', action: { label: '重试', onClick: () => undefined } })}>
                错误 Toast
              </Button>
            </div>
          </DemoSection>

          <DemoSection title="Collapse">
            <Button variant="default" onClick={() => setCollapseOpen((value) => !value)}>
              切换
            </Button>
            <Collapse open={collapseOpen} className="mt-[var(--space-3)]">
              <Card variant="dashed">折叠内容</Card>
            </Collapse>
          </DemoSection>

          <DemoSection title="DatePicker">
            <DatePicker name="birthday" label="生日" value={date} onChange={setDate} />
          </DemoSection>

          <DemoSection title="Modal">
            <Button variant="default" onClick={() => setDialogOpen(true)}>
              打开 Dialog
            </Button>
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="确认操作"
              description="桌面端显示 Modal，移动端显示 BottomSheet。"
              footer={
                <>
                  <Button variant="text" onClick={() => setDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={() => setDialogOpen(false)}>确认</Button>
                </>
              }
            >
              <p>这里是对话框内容。</p>
            </Dialog>
          </DemoSection>

          <DemoSection title="BottomSheet">
            <Button variant="default" onClick={() => setSheetOpen(true)}>
              打开 BottomSheet
            </Button>
            <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="选择宝宝">
              <div className="grid gap-[var(--space-2)]">
                {['小米', '小乐', '小雨'].map((name) => (
                  <button key={name} type="button" className="rounded-[14px] px-[var(--space-2)] py-[10px] text-left font-semibold active:bg-[var(--color-press-tint)]">
                    {name}
                  </button>
                ))}
              </div>
            </BottomSheet>
          </DemoSection>

          <DemoSection title="ActionSheet">
            <Button variant="default" onClick={() => setActionOpen(true)}>
              打开 ActionSheet
            </Button>
            <ActionSheet
              open={actionOpen}
              onOpenChange={setActionOpen}
              title="记录操作"
              options={[
                { label: '编辑', onSelect: () => undefined },
                { label: '移到回收站', destructive: true, onSelect: () => undefined }
              ]}
            />
          </DemoSection>

          <DemoSection title="PullToRefresh">
            <PullToRefresh onRefresh={async () => undefined}>
              <Card variant="dashed">下拉刷新容器</Card>
            </PullToRefresh>
          </DemoSection>

          <DemoSection title="AppShell">
            <div className="rounded-[var(--radius-card)] bg-[var(--color-bg)] p-[var(--space-4)]">
              <div className="text-center">
                <h2 className="text-[length:var(--text-2xl)] font-bold text-[color:var(--color-fg-strong)]">时光</h2>
                <p className="text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">AppShell header / body / Tabbar</p>
              </div>
            </div>
          </DemoSection>

          <DemoSection title="Tabbar">
            <p className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">
              Tabbar 固定在页面底部，便于同时核对真实定位、安全区和激活胶囊。
            </p>
          </DemoSection>
        </div>
      </div>
      <Tabbar />
    </main>
  );
}

function DemoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card as="section">
      <h2 className="mb-[var(--space-3)] text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg-strong)]">{title}</h2>
      {children}
    </Card>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
