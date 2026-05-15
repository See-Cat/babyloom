import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import BottomSheet from './BottomSheet';
import { entryApi, mediaApi } from '../services/entryApi';
import { useBabyStore } from '../stores/authStore';

interface EntryComposerSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EntryComposerSheet({
  isOpen,
  onClose,
}: EntryComposerSheetProps) {
  const queryClient = useQueryClient();
  const currentBaby = useBabyStore((state) => state.currentBaby);
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  const createMutation = useMutation({
    mutationFn: async (data: { babyId: string; content: string }) => {
      const response = await entryApi.createEntry(data);
      await Promise.all(
        mediaFiles.map((file) =>
          mediaApi.uploadMedia({
            babyId: data.babyId,
            entryId: response.data.id,
            file,
          })
        )
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      setContent('');
      setMediaFiles([]);
      onClose();
    },
  });

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || !currentBaby) return;

    createMutation.mutate({
      babyId: currentBaby.id,
      content: trimmed,
    });
  };

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setMediaFiles((current) => [...current, ...files]);
    event.target.value = '';
  };

  const removeMedia = (fileName: string) => {
    setMediaFiles((current) => current.filter((file) => file.name !== fileName));
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="记录这一刻">
      {!currentBaby ? (
        <div className="composer-empty">请先选择宝宝</div>
      ) : (
        <div className="entry-composer">
          <textarea
            className="composer-input"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="写点什么记录这一刻..."
            rows={4}
            autoFocus
          />
          <div className="composer-media">
            <label className="composer-media-add">
              <span className="composer-media-icon">+</span>
              <span>添加照片或视频</span>
              <input
                aria-label="添加照片或视频"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaChange}
              />
            </label>
            {mediaFiles.length > 0 && (
              <div className="composer-media-list">
                {mediaFiles.map((file) => (
                  <div className="composer-media-item" key={file.name}>
                    <span className="composer-media-name">{file.name}</span>
                    <button
                      type="button"
                      className="composer-media-remove"
                      aria-label={`移除 ${file.name}`}
                      onClick={() => removeMedia(file.name)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className="composer-submit"
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? '保存中...' : '记录这一刻'}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
