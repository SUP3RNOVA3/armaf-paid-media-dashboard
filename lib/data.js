import { createClient } from '@supabase/supabase-js';
import fallbackSnapshot from '@/public/data/dashboard-snapshot.json';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function getDashboardSnapshot() {
  if (!url || !anonKey) return fallbackSnapshot;

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await supabase
    .from('dashboard_snapshots')
    .select('payload, updated_at')
    .eq('brand', 'armaf')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) return fallbackSnapshot;

  return {
    ...data.payload,
    organicData: data.payload.organicData || fallbackSnapshot.organicData,
    googleAds: data.payload.googleAds || fallbackSnapshot.googleAds,
    backendUpdatedAt: data.updated_at,
    source: 'supabase'
  };
}
