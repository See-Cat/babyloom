import { useState, useCallback } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      if (diff > 0 && diff < 100) {
        e.preventDefault();
      }
    },
    [pulling, startY]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);

    const diff = startY - startY;
    if (diff > 60 && !refreshing) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  }, [pulling, startY, refreshing, onRefresh]);

  return (
    <div
      className={`pull-to-refresh ${refreshing ? 'refreshing' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {refreshing && (
        <div className="refresh-indicator">
          <div className="spinner" />
          <span>刷新中...</span>
        </div>
      )}
      {children}
    </div>
  );
}
