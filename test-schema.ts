import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testSchema() {
  const { data, error } = await supabase.from('distributors').select('*').limit(1);
  console.log('Distributors row:', data);
  console.log('Distributors error:', error);

  const { data: extData, error: extError } = await supabase.from('external_offices').select('*').limit(1);
  console.log('External Offices row:', extData);
  console.log('External Offices error:', extError);
}

testSchema();
