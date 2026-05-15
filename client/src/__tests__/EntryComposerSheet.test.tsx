import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EntryComposerSheet from '../components/EntryComposerSheet';
import { useBabyStore } from '../stores/authStore';
import { entryApi, mediaApi } from '../services/entryApi';

vi.mock('../services/entryApi', () => ({
  entryApi: {
    createEntry: vi.fn(),
  },
  mediaApi: {
    uploadMedia: vi.fn(),
  },
}));

function renderSheet(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <EntryComposerSheet isOpen onClose={onClose} />
    </QueryClientProvider>
  );

  return { onClose };
}

describe('EntryComposerSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBabyStore.setState({
      currentBaby: {
        id: 'baby-1',
        name: '小橘子',
        birthDate: '2025-09-15',
      },
      babies: [],
    });
  });

  it('creates a text entry for the selected baby', async () => {
    (entryApi.createEntry as any).mockResolvedValue({ data: { id: 'entry-1' } });
    const { onClose } = renderSheet();

    fireEvent.change(screen.getByPlaceholderText('写点什么记录这一刻...'), {
      target: { value: '宝宝今天第一次翻身了' },
    });
    fireEvent.click(screen.getByRole('button', { name: '记录这一刻' }));

    await waitFor(() => {
      expect(entryApi.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          babyId: 'baby-1',
          content: '宝宝今天第一次翻身了',
        })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not submit blank content', () => {
    renderSheet();

    expect(screen.getByRole('button', { name: '记录这一刻' })).toBeDisabled();
  });

  it('previews selected media, removes it, and uploads remaining media after entry creation', async () => {
    const firstFile = new File(['first'], 'first.jpg', { type: 'image/jpeg' });
    const secondFile = new File(['second'], 'second.mp4', { type: 'video/mp4' });
    (entryApi.createEntry as any).mockResolvedValue({ data: { id: 'entry-1' } });
    (mediaApi.uploadMedia as any).mockResolvedValue({ data: { id: 'media-1' } });

    renderSheet();

    fireEvent.change(screen.getByLabelText('添加照片或视频'), {
      target: { files: [firstFile, secondFile] },
    });

    expect(screen.getByText('first.jpg')).toBeInTheDocument();
    expect(screen.getByText('second.mp4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移除 first.jpg' }));
    expect(screen.queryByText('first.jpg')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('写点什么记录这一刻...'), {
      target: { value: '带视频的一条记录' },
    });
    fireEvent.click(screen.getByRole('button', { name: '记录这一刻' }));

    await waitFor(() => {
      expect(mediaApi.uploadMedia).toHaveBeenCalledWith({
        babyId: 'baby-1',
        entryId: 'entry-1',
        file: secondFile,
      });
    });
  });
});
