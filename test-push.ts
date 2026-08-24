import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testPush() {
  const distId = 'dist-12345';
  const validUuid = '11111111-1111-1111-1111-111111111111'; // A random UUID
  
  const { data, error } = await supabase.from('distributors').upsert([
    {
      id: validUuid,
      name: 'Test Dist',
      phone: '0123456789',
      code: 'TD1',
      address: null,
      is_active: true,
      balance: 0,
      total_orders_value: 0,
      total_supplied: 0,
      balance_due: 0,
      created_at: new Date().toISOString(),
    }
  ]);
  
  console.log('Distributors Error:', error);

  const { data: extData, error: extError } = await supabase.from('external_offices').upsert([
    {
      id: validUuid,
      name: 'Test Ext',
      contact_person: null,
      phone: '0123456789',
      specialty: null,
      address: null,
      is_active: true,
      balance: 0,
      total_jobs_count: 0,
      total_cost_paid: 0,
      created_at: new Date().toISOString(),
    }
  ]);

  console.log('External Offices Error:', extError);
}

testPush();
