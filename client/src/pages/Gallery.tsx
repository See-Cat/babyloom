import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useBabyStore } from '../stores/authStore';

export default function Gallery() {
  const navigate = useNavigate();
  const currentBaby = useBabyStore((state) => state.currentBaby);
  const [selectedType, setSelectedType] = useState<'all' | 'photo' | 'video'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['entries', currentBaby?.id],
    queryFn: () =>
      fetch(`/api/entries?babyId=${currentBaby?.id}`).then((res) => res.json()),
    enabled: !!currentBaby,
  });

  const entries = data?.items || [];

  const allMedia = entries.flatMap((entry: any) =>
    (entry.media || []).map((m: any) => ({
      ...m,
      entryId: entry.id,
      createdAt: entry.createdAt,
    }))
  );

  const filteredMedia =
    selectedType === 'all'
      ? allMedia
      : allMedia.filter((m: any) => m.type === selectedType);

  const groupedByMonth = filteredMedia.reduce((acc: any, item: any) => {
    const month = format(new Date(item.createdAt), 'yyyy年M月', { locale: zhCN });
    if (!acc[month]) acc[month] = [];
    acc[month].push(item);
    return acc;
  }, {});

  if (!currentBaby) {
    return (
      <div className="gallery-page">
        <div className="empty-state">
          <p>请先选择宝宝</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-page">
      <header className="gallery-header">
        <div>
          <p className="gallery-count">{filteredMedia.length} 张照片</p>
          <h1>画廊</h1>
        </div>
      </header>

      <div style={{ padding: '0 16px', marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            background: 'var(--surface)',
            padding: 4,
            borderRadius: 12,
            border: '0.5px solid var(--border)',
          }}
        >
          {(['all', 'photo', 'video'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                flex: 1,
                padding: '8px 16px',
                border: 'none',
                borderRadius: 8,
                background:
                  selectedType === type ? 'var(--accent)' : 'transparent',
                color: selectedType === type ? '#fff' : 'var(--muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {type === 'all' ? '全部' : type === 'photo' ? '照片' : '视频'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="loading-more">加载中...</div>
      ) : (
        Object.entries(groupedByMonth).map(([month, items]: [string, any]) => (
          <div key={month} className="gallery-month">
            <div className="gallery-month-label">{month}</div>
            <div className="gallery-grid">
              {(items as any[]).map((item, index) => (
                <motion.div
                  key={item.id}
                  className={`gallery-item ${index % 5 === 1 ? 'tall' : ''} ${index % 7 === 4 ? 'wide' : ''}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: index * 0.03,
                    duration: 0.3,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/detail/${item.entryId}`)}
                >
                  <img
                    src={item.type === 'video' ? item.thumbnail || item.url : item.url}
                    alt=""
                    loading="lazy"
                  />
                  {item.type === 'video' && (
                    <>
                      <div className="gallery-video-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="8,5 19,12 8,19" />
                        </svg>
                      </div>
                      <div className="gallery-badge">0:48</div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))
      )}

      {!isLoading && filteredMedia.length === 0 && (
        <div className="empty-state">
          <p>还没有照片</p>
          <p>点击底部 + 按钮添加</p>
        </div>
      )}
    </div>
  );
}
