'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/mobile/AppShell';
import { BabyCard } from '@/components/features/BabyCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker, nowDatePickerValue } from '@/components/ui/DatePicker';
import { birthdayDatePart } from '@/lib/format-time';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PlusIcon } from '@/components/ui/icons';

interface Baby {
  id: string;
  name: string;
  birthday: string;
  gender: string;
  avatarUrl?: string | null;
}

export default function BabiesAdminPage() {
  const [babies, setBabies] = useState<Baby[]>([]);
  const [creating, setCreating] = useState(false);
  const [newBaby, setNewBaby] = useState({ name: '', birthday: '', gender: 'girl' });

  async function reload() {
    const res = await fetch('/api/babies');
    if (!res.ok) return;
    const body = await res.json();
    setBabies(body.babies);
  }

  useEffect(() => {
    reload();
  }, []);

  async function createBaby() {
    const res = await fetch('/api/babies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(newBaby)
    });
    if (res.ok) {
      setCreating(false);
      setNewBaby({ name: '', birthday: '', gender: 'girl' });
      reload();
    }
  }

  return (
    <AppShell
      title="宝宝管理"
      leftSlot={
        <Link href="/profile" className="text-[length:var(--text-sm)] text-[color:var(--color-muted)]">
          返回
        </Link>
      }
    >
      <ul className="mb-[var(--space-6)] flex flex-col gap-[var(--space-3)]">
        {babies.map((b, index) => (
          <li key={b.id}>
            <BabyCard
              baby={b}
              active={index === 0}
              ageLabel={formatBabyAge(b.birthday)}
            />
          </li>
        ))}
      </ul>

      {creating ? (
        <Card className="flex flex-col gap-[var(--space-3)]">
          <Input label="名字" placeholder="名字" value={newBaby.name} onChange={(e) => setNewBaby({ ...newBaby, name: e.target.value })} />
          <DatePicker
            name="birthday"
            label="生日"
            mode="datetime"
            value={newBaby.birthday}
            maxValue={nowDatePickerValue('datetime')}
            onChange={(birthday) => setNewBaby({ ...newBaby, birthday })}
          />
          <SegmentedControl
            ariaLabel="性别"
            value={newBaby.gender}
            onChange={(value) => setNewBaby({ ...newBaby, gender: value })}
            className="grid-cols-3"
            options={[
              { value: 'girl', label: '女宝' },
              { value: 'boy', label: '男宝' },
              { value: 'other', label: '其他' }
            ]}
          />
          <div className="flex gap-[var(--space-2)]">
            <Button type="button" size="sm" onClick={createBaby}>
              创建
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
        </Card>
      ) : (
        <Button type="button" variant="secondary" leadingIcon={<PlusIcon />} onClick={() => setCreating(true)} fullWidth>
          添加宝宝
        </Button>
      )}
    </AppShell>
  );
}

function formatBabyAge(birthday: string) {
  const birth = new Date(`${birthdayDatePart(birthday)}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return birthday;
  const now = new Date();
  let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + now.getUTCMonth() - birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  if (years > 0) return `${years}岁${restMonths}月`;
  return `${restMonths}个月`;
}
