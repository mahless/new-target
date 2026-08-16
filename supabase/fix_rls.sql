-- ==============================================================================
-- FIX RLS PERMISSIONS, REALTIME & DISABLE RLS RESTRICTIONS FOR ALL TABLES
-- Run this script ONCE in Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Disable RLS on all tables so anon/publishable key can push & pull data freely
ALTER TABLE IF EXISTS branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS distributors DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS external_offices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cash_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS distributor_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS external_office_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS branch_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_closings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS idempotency_keys DISABLE ROW LEVEL SECURITY;

-- 2. Grant full permissions to anon & authenticated roles
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
    LOOP
        EXECUTE format('GRANT ALL ON TABLE %I TO anon, authenticated, postgres, service_role;', tbl);
    END LOOP;
END $$;

-- 3. Enable Realtime Live Streaming for all tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE branches, employees, services, customers, distributors, external_offices, expense_categories, service_orders, payments, cash_ledger, distributor_transactions, external_office_transactions, expenses, branch_transfers, daily_closings, audit_logs;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
