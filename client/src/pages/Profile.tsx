import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBabyStore } from '../stores/authStore';

export default function Profile() {
  const navigate = useNavigate();
  const currentBaby = useBabyStore((state) => state.currentBaby);
  const babies = useBabyStore((state) => state.babies);
  const setCurrentBaby = useBabyStore((state) => state.setCurrentBaby);

  const { data: entriesData } = useQuery({
    queryKey: ['entries', currentBaby?.id],
    queryFn: () =>
      fetch(`/api/entries?babyId=${currentBaby?.id}&limit=1`).then((res) =>
        res.json()
      ),
    enabled: !!currentBaby,
  });

  const { data: milestonesData } = useQuery({
    queryKey: ['milestones'],
    queryFn: () => fetch('/api/milestones').then((res) => res.json()),
  });

  const stats = [
    { label: '记录', value: entriesData?.total || 0 },
    { label: '照片', value: 0 },
    { label: '视频', value: 0 },
    { label: '里程碑', value: milestonesData?.length || 0 },
  ];

  const menuItems = [
    { icon: '🏷️', name: '里程碑', tag: '', path: '/milestones' },
    { icon: '👨‍👩‍👧', name: '家庭成员', tag: '', path: '' },
    { icon: '⚙️', name: '设置', tag: '', path: '' },
  ];

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          {currentBaby?.name?.[0] || '👶'}
        </div>
        <div className="profile-name">{currentBaby?.name || '未选择宝宝'}</div>
        {currentBaby?.birthDate && (
          <div className="profile-meta">
            {new Date().getFullYear() - new Date(currentBaby.birthDate).getFullYear()} 岁
          </div>
        )}
      </div>

      <div className="profile-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="profile-stat">
            <div className="profile-stat-number">{stat.value}</div>
            <div className="profile-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {babies.length > 1 && (
        <div className="profile-section">
          <div className="profile-section-title">切换宝宝</div>
          {babies.map((baby) => (
            <div
              key={baby.id}
              className="profile-row"
              onClick={() => setCurrentBaby(baby)}
              style={{
                background:
                  currentBaby?.id === baby.id
                    ? 'var(--accent-light)'
                    : 'transparent',
              }}
            >
              <div className="profile-row-avatar">{baby.name[0]}</div>
              <div className="profile-row-name">{baby.name}</div>
              {currentBaby?.id === baby.id && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--accent)',
                    fontWeight: 600,
                  }}
                >
                  当前
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="profile-section">
        <div className="profile-section-title">更多</div>
        {menuItems.map((item) => (
          <div
            key={item.name}
            className="profile-row"
            onClick={() => item.path && navigate(item.path)}
          >
            <div className="profile-row-avatar">{item.icon}</div>
            <div className="profile-row-name">{item.name}</div>
            {item.tag && (
              <div className="profile-row-tag">{item.tag}</div>
            )}
            <div className="profile-row-arrow">{'>'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
