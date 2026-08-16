-- ==============================================================================
-- FIX RLS PERMISSIONS & DISABLE RLS FOR ALL TABLES
-- Run this script ONCE in Supabase Dashboard -> SQL Editor to allow pushes
-- ==============================================================================

-- 1. Disable RLS on all tables so anon key can push & pull data freely
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
