import { useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Auto-refresh layar daftar ketika user LAIN menambah/ubah data di cabang yang
// sama — pakai Supabase Realtime (postgres_changes) supaya tidak perlu
// pull-to-refresh manual. `onChange` dipanggil setiap ada INSERT/UPDATE/DELETE
// di salah satu tabel, cukup untuk trigger reload penuh via `load()` yang sudah ada.
export function useRealtimeRefresh(tables: string[], branchId: string | undefined | null, onChange: () => void) {
  useEffect(() => {
    if (!branchId || tables.length === 0) return;

    const channel: RealtimeChannel = supabase.channel(`rt-${tables.join('-')}-${branchId}`);
    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `branch_id=eq.${branchId}` },
        () => onChange()
      );
    });
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), branchId]);
}
