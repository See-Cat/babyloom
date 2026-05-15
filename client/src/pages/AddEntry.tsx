import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entryApi, milestoneApi } from '../services/entryApi';
import { useBabyStore } from '../stores/authStore';

export default function AddEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentBaby = useBabyStore((state) => state.currentBaby);
  const [content, setContent] = useState('');
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);
  const [showMilestonePicker, setShowMilestonePicker] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const { data: milestonesData } = useQuery({
    queryKey: ['milestones'],
    queryFn: () => milestoneApi.getMilestones(),
  });

  const createMutation = useMutation({
    mutationFn: entryApi.createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      navigate('/');
    },
  });

  const handleSubmit = () => {
    if (!content.trim() || !currentBaby) return;

    createMutation.mutate({
      content: content.trim(),
      babyId: currentBaby.id,
      milestoneIds: selectedMilestones,
    });
  };

  const toggleMilestone = (id: string) => {
    setSelectedMilestones((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const milestones = milestonesData?.data || [];

  return (
    <>
      <motion.div
        className="add-entry-page"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="page-header">
          <button onClick={() => navigate(-1)} className="back-button">
            取消
          </button>
          <h1>记录成长</h1>
          <button
            onClick={handleSubmit}
            className="submit-button"
            disabled={!content.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? '保存中...' : '保存'}
          </button>
        </header>

        <div className="form-content">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录宝宝的成长瞬间..."
            className="content-input"
            rows={6}
            autoFocus
          />

          <div className="milestones-section">
            <div
              className="milestone-trigger"
              onClick={() => setShowMilestonePicker(true)}
            >
              <span>🏷️ 添加里程碑标签</span>
              <span className="arrow">{'>'}</span>
            </div>

            {selectedMilestones.length > 0 && (
              <div className="selected-milestones">
                {selectedMilestones.map((id) => {
                  const ms = milestones.find((m: any) => m.id === id);
                  return ms ? (
                    <span
                      key={id}
                      className="milestone-tag"
                      onClick={() => toggleMilestone(id)}
                    >
                      {ms.icon} {ms.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <div
              className="milestone-trigger"
              onClick={() => setShowActionSheet(true)}
            >
              <span>📷 添加照片/视频</span>
              <span className="arrow">{'>'}</span>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showMilestonePicker && (
          <>
            <motion.div
              className="bottom-sheet-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMilestonePicker(false)}
            />
            <motion.div
              className="bottom-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="bottom-sheet-handle" />
              <div className="bottom-sheet-title">选择里程碑</div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {milestones.map((milestone: any) => (
                  <button
                    key={milestone.id}
                    onClick={() => toggleMilestone(milestone.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: selectedMilestones.includes(milestone.id)
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border)',
                      background: selectedMilestones.includes(milestone.id)
                        ? 'var(--accent-light)'
                        : 'var(--surface)',
                      color: selectedMilestones.includes(milestone.id)
                        ? 'var(--accent)'
                        : 'var(--fg)',
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(.34,1.56,.64,1)',
                      transform: selectedMilestones.includes(milestone.id)
                        ? 'scale(1.05)'
                        : 'scale(1)',
                    }}
                  >
                    {milestone.icon} {milestone.name}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showActionSheet && (
          <>
            <motion.div
              className="bottom-sheet-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowActionSheet(false)}
            />
            <motion.div
              className="bottom-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="bottom-sheet-handle" />
              <div className="bottom-sheet-title">添加照片</div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {[
                  { icon: '📷', text: '拍照' },
                  { icon: '🖼️', text: '从相册选择' },
                ].map((action) => (
                  <div
                    key={action.text}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '16px 4px',
                      cursor: 'pointer',
                      borderBottom: '0.5px solid var(--border)',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => {
                      setShowActionSheet(false);
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: 'var(--accent-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                      }}
                    >
                      {action.icon}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 500 }}>
                      {action.text}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowActionSheet(false)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 14,
                  textAlign: 'center',
                  fontSize: 15,
                  color: 'var(--muted)',
                  background: 'none',
                  border: 'none',
                  borderTop: '8px solid oklch(95% 0.008 80)',
                  cursor: 'pointer',
                  marginTop: 8,
                  fontFamily: 'var(--font-b)',
                }}
              >
                取消
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
