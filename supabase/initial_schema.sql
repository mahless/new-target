-- ==============================================================================
-- منظومة إسناد المتكاملة لإدارة الخدمات الحكومية والتوثيقية | Esnad Multi-Branch System
-- Production PostgreSQL Database Schema for Supabase
-- Source of Truth: Application Codebase & Business Logic (src/lib/storage.ts, types, & components)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. CORE TABLES & SCHEMAS
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- Table: branches (الفروع ومكاتب التشغيل)
-- Description: الفروع المستقلة تشغيلياً ومالياً
-- ==============================================================================
CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_branches_code_not_empty CHECK (length(trim(code)) > 0),
    CONSTRAINT chk_branches_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ==============================================================================
-- Table: employees (الموظفون والمستخدمون)
-- Description: مستخدمو النظام مع حصر الصلاحيات في 3 أدوار (manager, employee, viewer)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    username TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    pin_code TEXT,
    password TEXT,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    default_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_employees_role CHECK (role IN ('manager', 'employee', 'viewer')),
    CONSTRAINT chk_employees_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ==============================================================================
-- Table: services (دليل الخدمات الحكومية والتسعير)
-- Description: قائمة الخدمات والسرعات المتاحة (عادي، مستعجل، فوري، سوبر فوري)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    category TEXT,
    speeds JSONB NOT NULL DEFAULT '[]'::jsonb,
    fields_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    execution_days INTEGER DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_services_base_price_non_negative CHECK (base_price >= 0),
    CONSTRAINT chk_services_days_non_negative CHECK (execution_days >= 0),
    CONSTRAINT chk_services_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ==============================================================================
-- Table: customers (دليل العملاء)
-- Description: بيانات طالبي الخدمات وحصر إجمالي معاملاتهم
-- ==============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    national_id TEXT,
    total_orders INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_customers_total_orders_non_negative CHECK (total_orders >= 0),
    CONSTRAINT chk_customers_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_customers_phone_not_empty CHECK (length(trim(phone)) > 0)
);

-- ==============================================================================
-- Table: distributors (الموزعون والوسطاء)
-- Description: الموزعون الخارجيون الذين يجلبون المعاملات وحساباتهم الآجلة
-- ==============================================================================
CREATE TABLE IF NOT EXISTS distributors (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_orders_value NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_supplied NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_distributors_orders_val_non_negative CHECK (total_orders_value >= 0),
    CONSTRAINT chk_distributors_total_supplied_non_negative CHECK (total_supplied >= 0),
    CONSTRAINT chk_distributors_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_distributors_code_not_empty CHECK (length(trim(code)) > 0)
);

-- ==============================================================================
-- Table: external_offices (المكاتب الخارجية المنفذة)
-- Description: المكاتب والشركاء الذين يتم إسناد المعاملات إليهم لتنفيذها
-- ==============================================================================
CREATE TABLE IF NOT EXISTS external_offices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT NOT NULL,
    specialty TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_jobs_count INTEGER NOT NULL DEFAULT 0,
    total_cost_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ext_offices_jobs_count_non_negative CHECK (total_jobs_count >= 0),
    CONSTRAINT chk_ext_offices_cost_paid_non_negative CHECK (total_cost_paid >= 0),
    CONSTRAINT chk_ext_offices_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ==============================================================================
-- Table: expense_categories (تصنيفات المصروفات)
-- Description: شجرة وبنود المصروفات التشغيلية والعمومية
-- ==============================================================================
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_exp_categories_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ==============================================================================
-- Table: service_orders (أوامر الخدمات والمعاملات)
-- Description: الجسد الرئيسي للمعاملات مع ربط الفروع، التسعير، الدفعات، والهامش
-- ==============================================================================
CREATE TABLE IF NOT EXISTS service_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_number TEXT UNIQUE NOT NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_national_id TEXT,
    service_id TEXT REFERENCES services(id) ON DELETE RESTRICT,
    service_name TEXT NOT NULL,
    speed TEXT NOT NULL DEFAULT 'عادي',
    form_barcode TEXT,
    form_source TEXT DEFAULT 'internal',
    custom_fields_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_paid NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    remaining NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cash_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    electronic_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    distributor_id TEXT REFERENCES distributors(id) ON DELETE SET NULL,
    external_office_id TEXT REFERENCES external_offices(id) ON DELETE SET NULL,
    external_office_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    office_margin NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    creation_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    current_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    delivery_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    created_by_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_orders_form_source CHECK (form_source IN ('internal', 'external')),
    CONSTRAINT chk_orders_status CHECK (status IN ('pending', 'in_progress', 'completed', 'delivered', 'cancelled')),
    CONSTRAINT chk_orders_price_non_negative CHECK (price >= 0),
    CONSTRAINT chk_orders_total_paid_non_negative CHECK (total_paid >= 0),
    CONSTRAINT chk_orders_remaining_non_negative CHECK (remaining >= 0),
    CONSTRAINT chk_orders_cash_amount_non_negative CHECK (cash_amount >= 0),
    CONSTRAINT chk_orders_electronic_amount_non_negative CHECK (electronic_amount >= 0),
    CONSTRAINT chk_orders_ext_office_cost_non_negative CHECK (external_office_cost >= 0),
    CONSTRAINT chk_orders_order_number_not_empty CHECK (length(trim(order_number)) > 0)
);

-- ==============================================================================
-- Table: payments (سجل الدفعات المستقلة)
-- Description: الدفعات النقدية والإلكترونية الجزئية أو الإجمالية لكل معاملة
-- ==============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL,
    cash_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    electronic_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    electronic_type TEXT,
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_payments_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_payments_cash_non_negative CHECK (cash_amount >= 0),
    CONSTRAINT chk_payments_electronic_non_negative CHECK (electronic_amount >= 0),
    CONSTRAINT chk_payments_electronic_type CHECK (electronic_type IN ('wallet', 'instapay', 'pos') OR electronic_type IS NULL)
);

-- ==============================================================================
-- Table: cash_ledger (دفتر الأستاذ المالي للدرج الخزني)
-- Description: القيود المالية الدقيقة المؤثرة على رصيد الكاش النقدي لكل فرع
-- ==============================================================================
CREATE TABLE IF NOT EXISTS cash_ledger (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    reference_table TEXT,
    reference_id TEXT,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ledger_type CHECK (transaction_type IN (
        'customer_cash_payment',
        'distributor_payment',
        'distributor_supply',
        'expense',
        'external_office_cost',
        'external_office_payment',
        'branch_transfer_in',
        'branch_transfer_out',
        'correction',
        'opening_balance',
        'daily_closing_payout'
    ))
);

-- ==============================================================================
-- Table: distributor_transactions (حركات حسابات الموزعين)
-- Description: قيود المديونية والتوريدات المالية الخاصة بالموزعين
-- ==============================================================================
CREATE TABLE IF NOT EXISTS distributor_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    distributor_id TEXT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    type TEXT NOT NULL,
    reference_id TEXT,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    balance_after NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_distributor_txns_type CHECK (type IN ('order_charge', 'supply_payment', 'opening_balance'))
);

-- ==============================================================================
-- Table: external_office_transactions (حركات حسابات المكاتب الخارجية)
-- Description: مستحقات وصرف مستحقات المكاتب الخارجية المنفذة
-- ==============================================================================
CREATE TABLE IF NOT EXISTS external_office_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    external_office_id TEXT NOT NULL REFERENCES external_offices(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    type TEXT NOT NULL,
    reference_id TEXT,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    balance_after NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ext_office_txns_type CHECK (type IN ('service_order_cost', 'office_payout', 'opening_balance'))
);

-- ==============================================================================
-- Table: expenses (المصروفات التشغيلية)
-- Description: سندات صرف النثريات والمصروفات المخصومة من خزينة الفرع
-- ==============================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    category_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
    category_name TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    related_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
    external_office_id TEXT REFERENCES external_offices(id) ON DELETE SET NULL,
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_expenses_amount_positive CHECK (amount > 0)
);

-- ==============================================================================
-- Table: branch_transfers (تحويلات النقدية بين الفروع)
-- Description: طلبات وسندات نقل وتوريد الأموال بين الفروع المختلفة
-- ==============================================================================
CREATE TABLE IF NOT EXISTS branch_transfers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reference_number TEXT UNIQUE,
    from_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    to_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL,
    sender_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    receiver_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_transfers_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_transfers_status CHECK (status IN ('pending', 'completed', 'rejected')),
    CONSTRAINT chk_transfers_diff_branches CHECK (from_branch_id <> to_branch_id)
);

-- ==============================================================================
-- Table: daily_closings (سجل وتقارير التقفيل والإغلاق اليومي)
-- Description: جرد الخزينة اليومي المقارن بين الرصيد المحسوب والرصيد الفعلي
-- ==============================================================================
CREATE TABLE IF NOT EXISTS daily_closings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    closing_date DATE NOT NULL,
    opening_balance NUMERIC(12,2) DEFAULT 0.00,
    system_calculated_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    actual_cash_count NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    difference NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    closing_type TEXT NOT NULL DEFAULT 'carry_over',
    total_cash_in NUMERIC(12,2) DEFAULT 0.00,
    total_cash_out NUMERIC(12,2) DEFAULT 0.00,
    total_electronic NUMERIC(12,2) DEFAULT 0.00,
    net_cash_balance NUMERIC(12,2) DEFAULT 0.00,
    total_orders_count INTEGER DEFAULT 0,
    total_expenses_count INTEGER DEFAULT 0,
    employee_name TEXT,
    closing_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_daily_closings_type CHECK (closing_type IN ('carry_over', 'payout_to_main'))
);

-- ==============================================================================
-- Table: audit_logs (سجل التتبع والمراقبة الأمنية)
-- Description: تتبع كافة عمليات الإضافة والتعديل والتغيير الإجرائي
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    employee_name TEXT NOT NULL,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT,
    entity_name TEXT,
    entity_id TEXT,
    old_data JSONB,
    new_data JSONB,
    changes JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Table: idempotency_keys (سجل منع تكرار المعاملات المالية)
-- Description: تخزين استجابات Idempotency لمنع المعاملات المزدوجة والـ Race Conditions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    endpoint TEXT,
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. INDEXES FOR PERFORMANCE OPTIMIZATION
-- ------------------------------------------------------------------------------

-- Service Orders Indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON service_orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_lookup ON service_orders (customer_id, customer_phone, customer_national_id);
CREATE INDEX IF NOT EXISTS idx_orders_barcode ON service_orders (form_barcode);
CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_branches ON service_orders (current_branch_id, creation_branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_distributor ON service_orders (distributor_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON service_orders (created_at DESC);

-- Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments (branch_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments (created_at DESC);

-- Cash Ledger Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_branch_created ON cash_ledger (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON cash_ledger (transaction_type);

-- Financial Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_dist_txns_distributor ON distributor_transactions (distributor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ext_office_txns_office ON external_office_transactions (external_office_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_closings_branch_date ON daily_closings (branch_id, closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, entity_id);

-- ------------------------------------------------------------------------------
-- 4. AUTOMATIC TIMESTAMPS TRIGGERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
CREATE TRIGGER trg_branches_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_distributors_updated_at ON distributors;
CREATE TRIGGER trg_distributors_updated_at
    BEFORE UPDATE ON distributors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_external_offices_updated_at ON external_offices;
CREATE TRIGGER trg_external_offices_updated_at
    BEFORE UPDATE ON external_offices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON service_orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON service_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_transfers_updated_at ON branch_transfers;
CREATE TRIGGER trg_transfers_updated_at
    BEFORE UPDATE ON branch_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) & PERMISSIVE ACCESS POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS for security architecture
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_office_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Permissive client policies for anon and authenticated roles
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_branches" ON branches';
    EXECUTE 'CREATE POLICY "Allow_all_branches" ON branches FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_employees" ON employees';
    EXECUTE 'CREATE POLICY "Allow_all_employees" ON employees FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_services" ON services';
    EXECUTE 'CREATE POLICY "Allow_all_services" ON services FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_customers" ON customers';
    EXECUTE 'CREATE POLICY "Allow_all_customers" ON customers FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_distributors" ON distributors';
    EXECUTE 'CREATE POLICY "Allow_all_distributors" ON distributors FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_external_offices" ON external_offices';
    EXECUTE 'CREATE POLICY "Allow_all_external_offices" ON external_offices FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_expense_categories" ON expense_categories';
    EXECUTE 'CREATE POLICY "Allow_all_expense_categories" ON expense_categories FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_service_orders" ON service_orders';
    EXECUTE 'CREATE POLICY "Allow_all_service_orders" ON service_orders FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_payments" ON payments';
    EXECUTE 'CREATE POLICY "Allow_all_payments" ON payments FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_cash_ledger" ON cash_ledger';
    EXECUTE 'CREATE POLICY "Allow_all_cash_ledger" ON cash_ledger FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_distributor_transactions" ON distributor_transactions';
    EXECUTE 'CREATE POLICY "Allow_all_distributor_transactions" ON distributor_transactions FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_external_office_transactions" ON external_office_transactions';
    EXECUTE 'CREATE POLICY "Allow_all_external_office_transactions" ON external_office_transactions FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_expenses" ON expenses';
    EXECUTE 'CREATE POLICY "Allow_all_expenses" ON expenses FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_branch_transfers" ON branch_transfers';
    EXECUTE 'CREATE POLICY "Allow_all_branch_transfers" ON branch_transfers FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_daily_closings" ON daily_closings';
    EXECUTE 'CREATE POLICY "Allow_all_daily_closings" ON daily_closings FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_audit_logs" ON audit_logs';
    EXECUTE 'CREATE POLICY "Allow_all_audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true)';

    EXECUTE 'DROP POLICY IF EXISTS "Allow_all_idempotency_keys" ON idempotency_keys';
    EXECUTE 'CREATE POLICY "Allow_all_idempotency_keys" ON idempotency_keys FOR ALL USING (true) WITH CHECK (true)';
END $$;

-- ------------------------------------------------------------------------------
-- 6. REALTIME LIVE STREAMING PUBLICATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE branches, employees, services, customers, distributors, external_offices, expense_categories, service_orders, payments, cash_ledger, distributor_transactions, external_office_transactions, expenses, branch_transfers, daily_closings, audit_logs;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
