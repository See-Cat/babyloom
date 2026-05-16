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
    { icon: '🏷️', name: '里程碑', path: '/milestones' },
    { icon: '👨‍👩‍👧', name: '家庭成员', path: '' },
    { icon: '⚙️', name: '设置', path: '' },
  ];

  const ageLabel = (() => {
    if (!currentBaby?.birthDate) return null;
    const years =
      new Date().getFullYear() - new Date(currentBaby.birthDate).getFullYear();
    return `${years} 岁`;
  })();

  return (
    <div className="ai-theme profile-page">
      <div className="ai-profile-hero">
        <div className="ai-profile-avatar">
          {currentBaby?.name?.[0] || '👶'}
        </div>
        <div className="ai-profile-name">
          {currentBaby?.name || '未选择宝宝'}
        </div>
        {ageLabel && <div className="ai-profile-meta">{ageLabel}</div>}
      </div>

      <div className="ai-profile-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="ai-stat-tile">
            <div className="ai-stat-num">{stat.value}</div>
            <div className="ai-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {babies.length > 1 && (
        <>
          <div className="ai-divider" />
          <div className="ai-section-title">切换宝宝</div>
          <div className="ai-row-list">
            {babies.map((baby) => {
              const isActive = currentBaby?.id === baby.id;
              return (
                <div
                  key={baby.id}
                  className={`ai-row${isActive ? ' is-active' : ''}`}
                  onClick={() => setCurrentBaby(baby)}
                >
                  <div className="ai-row-avatar">{baby.name[0]}</div>
                  <div className="ai-row-name">{baby.name}</div>
                  {isActive && <div className="ai-row-badge">当前</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="ai-divider" />
      <div className="ai-section-title">更多</div>
      <div className="ai-row-list">
        {menuItems.map((item) => (
          <div
            key={item.name}
            className="ai-row"
            onClick={() => item.path && navigate(item.path)}
          >
            <div className="ai-row-avatar">{item.icon}</div>
            <div className="ai-row-name">{item.name}</div>
            <div className="ai-row-arrow">›</div>
          </div>
        ))}
      </div>
    </div>
  );
}
