'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { ToastContext } from '@/components/ui/ToastProvider';
import { requireOnline } from '@/lib/client/require-online';
import { formatLongDateTime } from '@/lib/shared/format-time';

const SETTINGS_URL = '/api/settings/media-cleanup';
const RUN_URL = '/api/settings/media-cleanup/run';
const COUNT_URL = '/api/settings/media-cleanup/eligible-count';

export interface MediaCleanupClientProps {
  initial: {
    enabled: boolean;
    thresholdHours: number;
    lastRunAt: number | null;
    lastRunDeleted: number;
    minThresholdHours: number;
    maxThresholdHours: number;
    eligibleCount: number;
  };
  timeZone: string;
}

export function MediaCleanupClient({ initial, timeZone }: MediaCleanupClientProps) {
  const toast = React.useContext(ToastContext);
  const { minThresholdHours, maxThresholdHours } = initial;

  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [thresholdInput, setThresholdInput] = React.useState(String(initial.thresholdHours));
  const [savedThreshold, setSavedThreshold] = React.useState(initial.thresholdHours);
  const [lastRunAt, setLastRunAt] = React.useState(initial.lastRunAt);
  const [lastRunDeleted, setLastRunDeleted] = React.useState(initial.lastRunDeleted);
  const [eligibleCount, setEligibleCount] = React.useState(initial.eligibleCount);

  const [togglingEnabled, setTogglingEnabled] = React.useState(false);
  const [savingThreshold, setSavingThreshold] = React.useState(false);
  const [running, setRunning] = React.useState(false);

  const parsedThreshold = Number(thresholdInput);
  const thresholdValid =
    Number.isInteger(parsedThreshold) &&
    parsedThreshold >= minThresholdHours &&
    parsedThreshold <= maxThresholdHours;
  const thresholdError =
    thresholdInput.trim() === '' || !thresholdValid
      ? `请输入 ${minThresholdHours}–${maxThresholdHours} 之间的整数小时`
      : undefined;
  const thresholdDirty = parsedThreshold !== savedThreshold;

  async function refreshEligibleCount() {
    try {
      const res = await fetch(COUNT_URL);
      if (res.ok) setEligibleCount((await res.json()).count);
    } catch {
      // preview count is best-effort; leave the previous value on failure
    }
  }

  async function toggleEnabled(next: boolean) {
    if (!requireOnline(toast)) return;
    setEnabled(next); // optimistic
    setTogglingEnabled(true);
    try {
      const res = await fetch(SETTINGS_URL, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      });
      if (!res.ok) {
        setEnabled(!next); // rollback
        toast?.show({
          message: res.status === 503 ? '正在备份,稍后再试' : '保存失败,请稍后重试',
          variant: 'error'
        });
      }
    } catch {
      setEnabled(!next);
      toast?.show({ message: '保存失败,请稍后重试', variant: 'error' });
    } finally {
      setTogglingEnabled(false);
    }
  }

  async function saveThreshold() {
    if (!thresholdValid || !requireOnline(toast)) return;
    setSavingThreshold(true);
    try {
      const res = await fetch(SETTINGS_URL, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ thresholdHours: parsedThreshold })
      });
      if (!res.ok) {
        toast?.show({
          message: res.status === 503 ? '正在备份,稍后再试' : '保存失败,请稍后重试',
          variant: 'error'
        });
        return;
      }
      const body = await res.json();
      setSavedThreshold(body.thresholdHours);
      setThresholdInput(String(body.thresholdHours));
      toast?.show({ message: '已保存', variant: 'success' });
      await refreshEligibleCount();
    } catch {
      toast?.show({ message: '保存失败,请稍后重试', variant: 'error' });
    } finally {
      setSavingThreshold(false);
    }
  }

  async function runNow() {
    if (!requireOnline(toast)) return;
    setRunning(true);
    try {
      const res = await fetch(RUN_URL, { method: 'POST' });
      if (!res.ok) {
        toast?.show({
          message: res.status === 503 ? '清理当前不可用(正在备份或已被运维停用)' : '运行失败,请稍后重试',
          variant: 'error'
        });
        return;
      }
      const body = await res.json();
      setLastRunAt(body.lastRunAt);
      setLastRunDeleted(body.lastRunDeleted);
      toast?.show({ message: `已清理 ${body.orphansTrashed} 个`, variant: 'success' });
      await refreshEligibleCount();
    } catch {
      toast?.show({ message: '运行失败,请稍后重试', variant: 'error' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-[var(--space-4)]">
      <Card className="grid gap-[var(--space-5)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="min-w-0 flex-1">
            <p className="text-[length:var(--text-md)] font-bold text-[color:var(--color-fg-strong)]">
              自动清理
            </p>
            <p className="mt-[var(--space-1)] text-[length:var(--text-sm)] leading-[var(--leading-base)] text-[color:var(--color-muted)]">
              清理长期未保存到记录的草稿照片(移入回收站,可恢复)。
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={togglingEnabled}
            onCheckedChange={toggleEnabled}
            aria-label="自动清理开关"
          />
        </div>

        <div className="grid gap-[var(--space-5)]">
          <Input
            type="number"
            inputMode="numeric"
            label="草稿保留时长(小时)"
            min={minThresholdHours}
            max={maxThresholdHours}
            value={thresholdInput}
            error={thresholdError}
            onChange={(e) => setThresholdInput(e.target.value)}
          />
          <Button
            variant="default"
            disabled={!thresholdValid || !thresholdDirty || savingThreshold}
            loading={savingThreshold}
            onClick={saveThreshold}
          >
            保存时长
          </Button>
        </div>
      </Card>

      <Card className="grid gap-[var(--space-5)]">
        <dl className="grid grid-cols-3 gap-[var(--space-3)] text-center">
          <StatItem label="待清理" value={String(eligibleCount)} />
          <StatItem label="上次清理" value={String(lastRunDeleted)} />
          <StatItem
            label="上次运行"
            value={lastRunAt ? formatLongDateTime(lastRunAt, timeZone) : '从未'}
            small
          />
        </dl>

        <Button fullWidth loading={running} onClick={runNow}>
          {running ? '正在清理...' : '立即清理'}
        </Button>
      </Card>
    </div>
  );
}

function StatItem({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <p
        className={
          small
            ? 'text-[length:var(--text-xs)] font-bold text-[color:var(--color-fg-strong)]'
            : 'text-[length:var(--text-xl)] font-bold text-[color:var(--color-fg-strong)]'
        }
      >
        {value}
      </p>
      <p className="mt-[var(--space-1)] text-[length:var(--text-xs)] font-semibold text-[color:var(--color-muted)]">
        {label}
      </p>
    </div>
  );
}
