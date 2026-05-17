'use client';

import { useCallback, useEffect, useState } from 'react';

type Resource = 'entry' | 'media' | 'baby';

const paths: Record<Resource, string> = {
  entry: 'entries',
  media: 'media',
  baby: 'babies'
};

export interface TrashToast {
  id: string;
  label: string;
  resource: Resource;
}

export function useTrashAction(resource: Resource) {
  const [toast, setToast] = useState<TrashToast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const softDelete = useCallback(
    async (id: string, label: string, onDone?: () => void) => {
      const res = await fetch(`/api/${paths[resource]}/${id}/trash`, { method: 'POST' });
      if (!res.ok) return false;
      setToast({ id, label, resource });
      onDone?.();
      return true;
    },
    [resource]
  );

  const undo = useCallback(async () => {
    if (!toast) return false;
    const res = await fetch(`/api/${paths[toast.resource]}/${toast.id}/restore`, { method: 'POST' });
    if (!res.ok) return false;
    setToast(null);
    return true;
  }, [toast]);

  return { softDelete, toast, undo, dismiss: () => setToast(null) };
}
