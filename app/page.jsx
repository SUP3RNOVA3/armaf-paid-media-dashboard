import Dashboard from '@/components/Dashboard';
import { getDashboardSnapshot } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const snapshot = await getDashboardSnapshot();
  return <Dashboard initialSnapshot={snapshot} />;
}
