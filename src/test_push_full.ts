import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

envContent.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) {
    process.env[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
  }
});

if (typeof localStorage === 'undefined' || !localStorage) {
  const storageMap: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (key: string) => storageMap[key] || null,
    setItem: (key: string, val: string) => { storageMap[key] = val; },
    removeItem: (key: string) => { delete storageMap[key]; },
  };
}

async function testPush() {
  const { ResilientStorageService } = await import('./lib/storage');
  // Seed local storage with test data
  const storage = ResilientStorageService.getInstance();
  const { supabaseSyncService } = await import('./lib/supabase');

  console.log('Pushing to Supabase...');
  const res = await supabaseSyncService.pushToSupabase();
  console.log('Push Result:', JSON.stringify(res, null, 2));
}

testPush();
