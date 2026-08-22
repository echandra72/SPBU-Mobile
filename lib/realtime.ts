import { useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Dimatikan sementara: diduga jadi penyebab layar "looping"/tidak responsif di
// sebagian device (kemungkinan koneksi WebSocket Realtime macet/di-blok
// jaringan tertentu). Set true lagi setelah root cause dikonfirmasi & ada
// penanganan gagal-koneksi yang lebih aman (timeout, fallback, dsb).
const REALTIME_ENABLED = false;

// Auto-refresh layar daftar ketika user LAIN menambah/ubah data di cabang yang
// sama — pakai Supabase Realtime (postgres_changes) supaya tidak perlu
// pull-to-refresh manual. `onChange` dipanggil setiap ada INSERT/UPDATE/DELETE
// di salah satu tabel, cukup untuk trigger reload penuh via `load()` yang sudah ada.
export function useRealtimeRefresh(tables: string[], branchId: string | undefined | null, onChange: () => void) {
  useEffect(() => {
    if (!REALTIME_ENABLED || !branchId || tables.length === 0) return;

    let channel: RealtimeChannel | null = null;
    try {
      channel = supabase.channel(`rt-${tables.join('-')}-${branchId}`);
      tables.forEach((table) => {
        channel!.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `branch_id=eq.${branchId}` },
          () => onChange()
        );
      });
      channel.subscribe();
    } catch {
      // Realtime gagal (mis. WebSocket diblok jaringan) — jangan sampai
      // mengganggu layar; data tetap bisa dimuat lewat load() biasa/manual.
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), branchId]);
}
