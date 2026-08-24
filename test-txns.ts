import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function testPush() {
  const validUuid = '11111111-1111-1111-1111-111111111111'; // A random UUID
  
  const { error } = await supabase.from('distributor_transactions').upsert([
    {
      id: validUuid,
      distributor_id: validUuid,
      branch_id: validUuid,
      employee_id: validUuid,
      amount: 0,
      type: 'order_charge',
      reference_id: null,
      idempotency_key: null,
      notes: null,
      balance_after: 0,
      created_at: new Date().toISOString(),
    }
  ]);
  
  console.log('distributor_transactions Error:', error);

  const { error: extError } = await supabase.from('external_office_transactions').upsert([
    {
      id: validUuid,
      external_office_id: validUuid,
      branch_id: validUuid,
      employee_id: validUuid,
      amount: 0,
      type: 'service_order_cost',
      reference_id: null,
      idempotency_key: null,
      notes: null,
      balance_after: 0,
      created_at: new Date().toISOString(),
    }
  ]);

  console.log('external_office_transactions Error:', extError);
}

testPush();
