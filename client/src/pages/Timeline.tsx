import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, isSameDay, isToday, isYesterday } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { entryApi } from '../services/entryApi';
import { useBabyStore } from '../stores/authStore';
import TimelineCard from '../components/TimelineCard';

function getDateLabel(date: Date) {
  if (isToday(date)) return '今天';
  if (isYesterday(date)) return '昨天';
  return format(date, 'M月d日', { locale: zhCN });
}

function groupEntriesByDate(entries: any[]) {
  return entries.reduce<Array<{ date: Date; entries: any[] }>>((groups, entry) => {
    const entryDate = new Date(entry.createdAt);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && isSameDay(lastGroup.date, entryDate)) {
      lastGroup.entries.push(entry);
      return groups;
    }

    groups.push({ date: entryDate, entries: [entry] });
    return groups;
  }, []);
}

export default function Timeline() {
  const navigate = useNavigate();
  const currentBaby = useBabyStore((state) => state.currentBaby);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['entries', currentBaby?.id, page],
    queryFn: () =>
      entryApi.getEntries({
        babyId: currentBaby?.id,
        page,
        limit: 20,
      }),
    enabled: !!currentBaby,
  });

  const entries = data?.data?.items || [];
  const entryGroups = groupEntriesByDate(entries);

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  if (!currentBaby) {
    return (
      <div className="timeline-page">
        <div className="empty-state">
          <p>请先选择宝宝</p>
        </div>
      </div>
    );
  }

  const today = new Date();

  return (
    <div className="timeline-page">
      <header className="timeline-header">
        <h1>{currentBaby.name}的成长时光</h1>
        <p className="subtitle">
          {format(today, 'yyyy年MM月dd日', { locale: zhCN })}
          {isToday(today) && ' · 今天'}
        </p>
      </header>

      <div className="timeline-content">
        {entryGroups.map((group, groupIndex) => (
          <div className="date-section" key={group.date.toISOString()}>
            <div className="date-header">
              <span className="date-label">{getDateLabel(group.date)}</span>
              <span className="date-detail">
                {format(group.date, 'M月d日 · EEEE', { locale: zhCN })}
              </span>
            </div>
            {group.entries.map((entry: any, entryIndex: number) => (
              <div
                key={entry.id}
                onClick={() => navigate(`/detail/${entry.id}`)}
              >
                <TimelineCard
                  entry={entry}
                  index={groupIndex + entryIndex}
                />
              </div>
            ))}
          </div>
        ))}

        {isLoading && (
          <div className="loading-more">加载中...</div>
        )}

        {!isLoading && entries.length > 0 && (
          <button className="load-more" onClick={handleLoadMore}>
            加载更多
          </button>
        )}

        {!isLoading && entries.length === 0 && (
          <div className="empty-state">
            <p>还没有记录</p>
            <p>点击底部 + 按钮添加第一条记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
