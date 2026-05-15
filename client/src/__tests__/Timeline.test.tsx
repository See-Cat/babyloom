import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { subDays } from 'date-fns';
import Timeline from '../pages/Timeline';
import { useBabyStore } from '../stores/authStore';
import { entryApi } from '../services/entryApi';

vi.mock('../services/entryApi', () => ({
  entryApi: {
    getEntries: vi.fn(),
  },
}));

vi.mock('../components/TimelineCard', () => ({
  default: ({ entry }: any) => <article>{entry.content}</article>,
}));

function renderTimeline() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Timeline', () => {
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

  it('groups entries by today, yesterday, and older dates', async () => {
    const older = subDays(new Date(), 3);
    (entryApi.getEntries as any).mockResolvedValue({
      data: {
        items: [
          {
            id: 'today-entry',
            content: '今天的记录',
            createdAt: new Date().toISOString(),
            media: [],
            milestones: [],
          },
          {
            id: 'yesterday-entry',
            content: '昨天的记录',
            createdAt: subDays(new Date(), 1).toISOString(),
            media: [],
            milestones: [],
          },
          {
            id: 'older-entry',
            content: '更早的记录',
            createdAt: older.toISOString(),
            media: [],
            milestones: [],
          },
        ],
      },
    });

    renderTimeline();

    await waitFor(() => {
      expect(screen.getByText('今天')).toBeInTheDocument();
    });
    expect(screen.getByText('昨天')).toBeInTheDocument();
    expect(screen.getByText(`${older.getMonth() + 1}月${older.getDate()}日`)).toBeInTheDocument();
    expect(screen.getByText('今天的记录')).toBeInTheDocument();
    expect(screen.getByText('昨天的记录')).toBeInTheDocument();
    expect(screen.getByText('更早的记录')).toBeInTheDocument();
  });
});
