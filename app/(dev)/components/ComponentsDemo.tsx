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
import { ArrowDownIcon, CheckIcon, ErrorIcon, InfoIcon, PlusIcon, WarningIcon } from '@/components/ui/icons';
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
    <main className="min-h-screen bg-[var(--color-bg)] px-[var(--space-4)] pb-[var(--space-8)] pt-[var(--space-8)] text-[color:var(--color-fg)]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-[var(--space-7)]">
          <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[color:var(--color-fg-soft)]">Tokens</p>
          <h1 className="text-[length:var(--text-2xl)] font-bold leading-[var(--leading-tight)] text-[color:var(--color-fg-strong)]">
            Babyloom 组件状态参考
          </h1>
          <p className="mt-[var(--space-1)] text-[length:var(--text-md)] font-semibold text-[color:var(--color-fg-soft)]">
            对照 2026-05-18-components-reference.html 展示通用组件关键状态。
          </p>
        </header>

        <div className="grid gap-[var(--space-6)]">
          <DemoSection title="Button">
            <StateGroup title="Primary(主行动 / FAB / 主 CTA)">
              <StateCell label="md default"><Button>保存</Button></StateCell>
              <StateCell label="md :active"><Button style={{ transform: 'translateY(4px)', boxShadow: '0 1px 0 0 var(--color-press-shadow-primary)' }}>保存</Button></StateCell>
              <StateCell label="md :focus"><Button style={{ outline: '3px solid var(--color-focus)', outlineOffset: 2 }}>保存</Button></StateCell>
              <StateCell label="md disabled"><Button disabled>保存</Button></StateCell>
              <StateCell label="md loading"><Button loading>保存中…</Button></StateCell>
              <StateCell label="sm"><Button size="sm">保存</Button></StateCell>
              <StateCell label="md"><Button>保存</Button></StateCell>
              <StateCell label="lg"><Button size="lg">保存</Button></StateCell>
              <StateCell label="w/ icon"><Button leadingIcon={<PlusIcon />}>新建</Button></StateCell>
            </StateGroup>
            <StateGroup title="Default / Danger / Ghost / Text / Link">
              <StateCell label="default"><Button variant="default">取消</Button></StateCell>
              <StateCell label="default :active"><Button variant="default" style={{ transform: 'translateY(3px)', boxShadow: 'var(--shadow-press-md-active)' }}>取消</Button></StateCell>
              <StateCell label="default disabled"><Button variant="default" disabled>取消</Button></StateCell>
              <StateCell label="danger"><Button variant="danger">删除</Button></StateCell>
              <StateCell label="danger :active"><Button variant="danger" style={{ transform: 'translateY(4px)', boxShadow: '0 1px 0 0 var(--color-press-shadow-error)' }}>删除</Button></StateCell>
              <StateCell label="danger loading"><Button variant="danger" loading>删除中…</Button></StateCell>
              <StateCell label="ghost"><Button variant="ghost-primary">更多</Button></StateCell>
              <StateCell label="text"><Button variant="text">了解详情</Button></StateCell>
              <StateCell label="link"><Button variant="link">查看全部</Button></StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="Input">
            <StateGroup title="Input 状态">
              <StateCell label="default"><Input placeholder="给宝宝起个名字" /></StateCell>
              <StateCell label="filled"><Input defaultValue="小乐" /></StateCell>
              <StateCell label=":focus"><Input defaultValue="小乐" className="focus" /></StateCell>
              <StateCell label="error"><Input defaultValue="ab" error="至少 3 个字符" /></StateCell>
              <StateCell label="disabled"><Input defaultValue="只读" disabled /></StateCell>
            </StateGroup>
            <StateGroup title="Input slot(leading / trailing)">
              <StateCell label="leading icon"><Input placeholder="搜索" leadingSlot={<SearchIcon />} /></StateCell>
              <StateCell label="trailing icon"><Input defaultValue="•••••••" trailingSlot={<EyeIcon />} /></StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="Textarea">
            <StateGroup title="Textarea">
              <StateCell label="default"><Textarea placeholder="今天小乐做了什么呢…" /></StateCell>
              <StateCell label="filled"><Textarea defaultValue={'第一次自己端着小碗吃完一整碗粥，从头到尾都没掉。还学会用手指比"好"。'} /></StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="Switch">
            <StateGroup>
              <StateCell label="off"><Switch checked={false} aria-label="关闭状态" onCheckedChange={() => undefined} /></StateCell>
              <StateCell label="on"><Switch checked aria-label="开启状态" onCheckedChange={() => undefined} /></StateCell>
              <StateCell label="disabled off"><Switch checked={false} disabled aria-label="禁用关闭状态" onCheckedChange={() => undefined} /></StateCell>
              <StateCell label="disabled on"><Switch checked disabled aria-label="禁用开启状态" onCheckedChange={() => undefined} /></StateCell>
              <StateCell label="interactive">
                <div className="flex items-center gap-[var(--space-3)]">
                  <Switch checked={enabled} aria-label="启用提醒" onCheckedChange={setEnabled} />
                  <span className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">{enabled ? '已开启' : '已关闭'}</span>
                </div>
              </StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="Tag">
            <StateGroup>
              <StateCell label="neutral"><Tag>第一次</Tag></StateCell>
              <StateCell label="accent"><Tag variant="accent">里程碑</Tag></StateCell>
              <StateCell label="error"><Tag variant="error">超出</Tag></StateCell>
              <StateCell label="removable"><Tag variant="accent" removable onRemove={() => undefined}>辅食</Tag></StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="Avatar">
            <StateGroup title="尺寸">
              <StateCell label="xs 24"><Avatar name="乐" size="xs" colorKey="pink" /></StateCell>
              <StateCell label="sm 32"><Avatar name="乐" size="sm" colorKey="pink" /></StateCell>
              <StateCell label="md 40"><Avatar name="乐" size="md" colorKey="pink" /></StateCell>
              <StateCell label="lg 56"><Avatar name="乐" size="lg" colorKey="pink" /></StateCell>
              <StateCell label="xl 88"><Avatar name="乐" size="xl" colorKey="pink" /></StateCell>
            </StateGroup>
            <StateGroup title="AvatarGroup(叠层)">
              <StateCell label="2 人"><AvatarGroup avatars={avatars.slice(0, 2)} /></StateCell>
              <StateCell label="4 人"><AvatarGroup avatars={avatars} max={4} /></StateCell>
              <StateCell label="+N 溢出"><AvatarGroup avatars={avatars} max={3} /></StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="AvatarPicker">
            <AvatarPicker name="小米" colorKey="baby-picker" hint="头像可选 · 不上传时自动用昵称首字" />
          </DemoSection>

          <DemoSection title="Card">
            <StateGroup title="Variants">
              <StateCell label="default"><Card className="w-[260px]"><p className="font-bold">第一次会爬</p><p>从客厅一头爬到另一头。</p></Card></StateCell>
              <StateCell label="dashed(空态)"><Card variant="dashed" className="w-[260px]">今天还没有记录</Card></StateCell>
              <StateCell label="tinted-pink"><Card variant="tinted" tint="pink" className="w-[260px]">第一次微笑</Card></StateCell>
              <StateCell label="tinted-mint"><Card variant="tinted" tint="mint" className="w-[260px]">第一次自己吃饭</Card></StateCell>
              <StateCell label="tinted-yellow"><Card variant="tinted" tint="yellow" className="w-[260px]">会说“奶奶”</Card></StateCell>
            </StateGroup>
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
            <StateGroup>
              <StateCell label="sm 16"><Spinner size="sm" /></StateCell>
              <StateCell label="md 24"><Spinner /></StateCell>
              <StateCell label="lg 32"><Spinner size="lg" /></StateCell>
              <StateCell label="在 Button 中"><Button variant="default" leadingIcon={<Spinner size="sm" />}>加载中</Button></StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="Toast">
            <StateGroup title="Toast 状态">
              <StateCell label="info(默认)"><div className="toast"><span className="icon"><InfoIcon /></span>已保存</div></StateCell>
              <StateCell label="success"><div className="toast success"><span className="icon"><CheckIcon /></span>记录已发布</div></StateCell>
              <StateCell label="error"><div className="toast error"><span className="icon"><ErrorIcon /></span>网络错误，请重试</div></StateCell>
              <StateCell label="warning"><div className="toast warning"><span className="icon"><WarningIcon /></span>未保存的修改</div></StateCell>
              <StateCell label="info + action"><div className="toast">已移到回收站<button className="action">撤销</button></div></StateCell>
              <StateCell label="error + action"><div className="toast error">上传失败<button className="action">重试</button></div></StateCell>
            </StateGroup>
            <StateGroup title="Interactive">
              <StateCell label="show info"><Button variant="default" onClick={() => toast.show({ message: '已保存' })}>普通 Toast</Button></StateCell>
              <StateCell label="show success"><Button variant="success" onClick={() => toast.show({ message: '保存成功', variant: 'success' })}>成功 Toast</Button></StateCell>
              <StateCell label="show error"><Button variant="danger" onClick={() => toast.show({ message: '删除失败', variant: 'error', action: { label: '重试', onClick: () => undefined } })}>错误 Toast</Button></StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="Collapse">
            <StateGroup>
              <StateCell label="closed"><Collapse title="关于本次记录">详细信息会在这里展示，展开收起带 350ms 缓动。</Collapse></StateCell>
              <StateCell label="open"><Collapse title="已展开" defaultOpen>点击会收起。reduced-motion 下展开/收起立即完成。</Collapse></StateCell>
            </StateGroup>
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
                    {baby.active && <CheckIcon className="h-4 w-4 text-[color:var(--color-primary-active)]" />}
                  </button>
                ))}
                <button
                  type="button"
                  className="mt-[6px] flex items-center gap-[10px] border-t border-[color:var(--color-border-light)] px-[6px] pt-[14px] text-[length:var(--text-base)] font-bold text-[color:var(--color-primary-active)]"
                  onClick={() => setSheetOpen(false)}
                >
                  <PlusIcon className="h-4 w-4" /> 添加新宝宝
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
            <StateGroup>
              <StateCell label="idle"><Card className="w-[220px] text-center"><ArrowDownIcon className="mx-auto h-6 w-6" /><div>下拉刷新</div></Card></StateCell>
              <StateCell label="pulling"><Card className="w-[220px] text-center"><ArrowDownIcon className="mx-auto h-6 w-6 rotate-180" /><div>松开刷新</div></Card></StateCell>
              <StateCell label="refreshing"><Card className="w-[220px] text-center"><Spinner /><div>正在刷新…</div></Card></StateCell>
              <StateCell label="interactive"><PullToRefresh onRefresh={async () => undefined}><Card variant="dashed" className="w-[260px]">下拉刷新容器</Card></PullToRefresh></StateCell>
            </StateGroup>
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
            <div className="w-full max-w-[360px] overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border-light)] bg-[var(--color-bg)]">
              <div className="grid h-20 place-items-center text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">时间轴</div>
              <Tabbar fixed={false} activeHref="/timeline" />
            </div>
          </DemoSection>

          <DemoSection title="FAB">
            <StateGroup>
              <StateCell label="default"><button className="fab" aria-label="新建"><PlusIcon /></button></StateCell>
              <StateCell label=":active(模拟)"><button className="fab" style={{ transform: 'translateY(4px)', boxShadow: '0 1px 0 0 var(--color-press-shadow-primary)' }} aria-label="新建"><PlusIcon /></button></StateCell>
              <StateCell label=":focus"><button className="fab" style={{ outline: '3px solid var(--color-focus)', outlineOffset: 3 }} aria-label="新建"><PlusIcon /></button></StateCell>
            </StateGroup>
          </DemoSection>

          <DemoSection title="Modal / BottomSheet / ActionSheet">
            <p className="mb-[var(--space-3)] text-[length:var(--text-sm)] font-semibold text-[color:var(--color-fg-soft)]">
              Modal: surface-2 / radius-lg / shadow-soft-lg；BottomSheet: 顶圆角 24 / handle 36×4；ActionSheet: radius-base / 取消块独立。
            </p>
            <div className="flex flex-wrap gap-[var(--space-2)]">
              <Button variant="default" onClick={() => setDialogOpen(true)}>打开 Modal</Button>
              <Button variant="default" onClick={() => setSheetOpen(true)}>打开 BottomSheet</Button>
              <Button variant="default" onClick={() => setActionOpen(true)}>打开 ActionSheet</Button>
            </div>
          </DemoSection>
        </div>
      </div>
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

function StateGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-[var(--space-4)] last:mb-0">
      {title && <h3 className="mb-[var(--space-2)] text-[length:var(--text-md)] font-bold text-[color:var(--color-fg)]">{title}</h3>}
      <div className="flex flex-wrap items-start gap-[var(--space-4)]">{children}</div>
    </div>
  );
}

function StateCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[120px] flex-col gap-[6px]">
      <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[color:var(--color-fg-soft)]">{label}</span>
      {children}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    </svg>
  );
}
