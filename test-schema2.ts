import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkColumns(table: string) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(`Columns for ${table}:`, data ? Object.keys(data[0] || {}) : error);
}

checkColumns('distributors');
checkColumns('external_offices');
