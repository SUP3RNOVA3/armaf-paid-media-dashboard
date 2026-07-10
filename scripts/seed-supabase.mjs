import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const payload = JSON.parse(fs.readFileSync('public/data/dashboard-snapshot.json', 'utf8'));
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { error } = await supabase
  .from('dashboard_snapshots')
  .upsert({
    brand: 'armaf',
    payload,
    updated_at: new Date().toISOString()
  }, { onConflict: 'brand' });

if (error) throw error;
console.log('Seeded dashboard_snapshots brand=armaf');
