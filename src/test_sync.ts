import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) {
    envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || '';
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY || '';

console.log('Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const tables = [
    'branches',
    'employees',
    'services',
    'customers',
    'distributors',
    'external_offices',
    'expense_categories',
    'service_orders',
    'payments',
    'cash_ledger',
    'distributor_transactions',
    'expenses',
    'branch_transfers',
    'daily_closings',
    'audit_logs',
    'idempotency_keys'
  ];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.error(`❌ Table [${t}] Error:`, error.message, '| Code:', error.code);
    } else {
      console.log(`✅ Table [${t}] Access OK!`);
    }
  }
}

test();
