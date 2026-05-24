'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';
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
import { Modal } from '@/components/ui/Modal';
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
  const [date, setDate] = React.useState('2024-08-01');
  const [datetime, setDatetime] = React.useState('2024-08-01 09:30');
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
            </div>
          </DemoSection>

          <DemoSection title="FAB">
            <button className="fab" aria-label="新建">
              +
            </button>
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
            <Collapse title="关于本次记录" defaultOpen>
              详细信息会在这里展示，展开收起带 350ms 缓动。
            </Collapse>
          </DemoSection>

          <DemoSection title="DatePicker">
            <div className="grid gap-[var(--space-3)]">
              <DatePicker name="birthday" label="生日（日期）" value={date} onChange={setDate} />
              <DatePicker name="event" label="事件时间（日期+时分）" mode="datetime" value={datetime} onChange={setDatetime} />
            </div>
          </DemoSection>

          <DemoSection title="Modal">
            <Button variant="default" onClick={() => setDialogOpen(true)}>
              打开 Modal
            </Button>
            <Modal
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="确认删除这条记录？"
              description="删除后会进回收站，30 天内可以恢复。"
              footer={
                <>
                  <Button variant="default" onClick={() => setDialogOpen(false)}>
                    取消
                  </Button>
                  <Button variant="danger" onClick={() => setDialogOpen(false)}>
                    删除
                  </Button>
                </>
              }
            />

          </DemoSection>

          <DemoSection title="BottomSheet">
            <Button variant="default" onClick={() => setSheetOpen(true)}>
              打开 BottomSheet
            </Button>
            <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="切换宝宝">
              <div className="flex flex-col">
                {[
                  { name: '小乐', avatar: '乐', age: '1岁3月', colorKey: 'le', active: true },
                  { name: '小安', avatar: '安', age: '3岁8月', colorKey: 'an', active: false }
                ].map((baby) => (
                  <button
                    key={baby.name}
                    type="button"
                    className={cn(
                      'flex items-center gap-[var(--space-3)] rounded-[14px] px-[6px] py-[10px] text-left',
                      baby.active && 'bg-[var(--color-surface)]'
                    )}
                    onClick={() => setSheetOpen(false)}
                  >
                    <Avatar name={baby.avatar} size="sm" colorKey={baby.colorKey} />
                    <span className="flex-1 text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">{baby.name}</span>
                    <span className="text-[length:var(--text-xs)] font-semibold text-[color:var(--color-fg-soft)]">{baby.age}</span>
                    {baby.active && <span className="text-[color:var(--color-primary-active)] font-bold">✓</span>}
                  </button>
                ))}
                <button
                  type="button"
                  className="mt-[6px] flex items-center gap-[10px] border-t border-[color:var(--color-border-light)] px-[6px] pt-[14px] text-[length:var(--text-base)] font-bold text-[color:var(--color-primary-active)]"
                  onClick={() => setSheetOpen(false)}
                >
                  ＋ 添加新宝宝
                </button>
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
                { label: '编辑', emphasized: true, onSelect: () => undefined },
                { label: '复制内容', onSelect: () => undefined },
                { label: '设为里程碑', onSelect: () => undefined },
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

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
