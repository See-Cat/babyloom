import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { entryApi } from '../services/entryApi';

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => entryApi.getEntry(id!),
    enabled: !!id,
  });

  const entry = data?.data;

  if (isLoading) {
    return <div className="loading">加载中...</div>;
  }

  if (!entry) {
    return <div className="loading">记录不存在</div>;
  }

  const hasMedia = entry.media && entry.media.length > 0;

  return (
    <motion.div
      className="detail-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {hasMedia ? (
        <>
          <div
            className="detail-photo"
            style={{
              backgroundImage: `url(${entry.media[currentSlide].url})`,
            }}
          />
          <button className="detail-close" onClick={() => navigate(-1)}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {entry.media.length > 1 && (
            <div className="carousel-dots" style={{ bottom: 20 }}>
              {entry.media.map((_: any, idx: number) => (
                <div
                  key={idx}
                  className={`carousel-dot ${idx === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(idx)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 24,
            background: 'var(--bg)',
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              padding: 8,
              alignSelf: 'flex-start',
              marginBottom: 16,
            }}
          >
            ←
          </button>

          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              border: '0.5px solid var(--border)',
            }}
          >
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: 'var(--fg)',
                marginBottom: 16,
              }}
            >
              {entry.content}
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {format(new Date(entry.createdAt), 'yyyy年MM月dd日 HH:mm', {
                  locale: zhCN,
                })}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {entry.creator?.nickname}
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
