import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { milestoneApi } from '../services/entryApi';

export default function Milestones() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['milestones'],
    queryFn: () => milestoneApi.getMilestones(),
  });

  const milestones = data?.data || [];

  const filteredMilestones = searchQuery
    ? milestones.filter((m: any) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : milestones;

  if (isLoading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="milestones-page">
      <header
        style={{
          padding: '16px 24px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
          }}
        >
          ←
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-d)',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          里程碑
        </h1>
        <div style={{ width: 40 }} />
      </header>

      <div style={{ padding: '0 16px', marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface)',
            padding: '10px 14px',
            borderRadius: 12,
            border: '0.5px solid var(--border)',
          }}
        >
          <span>🔍</span>
          <input
            type="text"
            placeholder="搜索里程碑..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: 14,
              fontFamily: 'var(--font-b)',
            }}
          />
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {filteredMilestones.map((milestone: any) => (
          <motion.div
            key={milestone.id}
            className="milestone-entry"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="milestone-entry-icon">
              {milestone.icon || '🏷️'}
            </div>
            <div className="milestone-entry-info">
              <div className="milestone-entry-title">{milestone.name}</div>
              {milestone.description && (
                <div className="milestone-entry-desc">
                  {milestone.description}
                </div>
              )}
            </div>
            <div className="milestone-entry-count">0</div>
            <div className="milestone-entry-arrow">{'>'}</div>
          </motion.div>
        ))}

        {filteredMilestones.length === 0 && (
          <div className="empty-state">
            <p>{searchQuery ? '未找到匹配的里程碑' : '还没有里程碑'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
