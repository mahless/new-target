-- ==============================================================================
-- منظومة إسناد المتكاملة لإدارة الخدمات الحكومية والتوثيقية | Esnad Multi-Branch System
-- Production PostgreSQL Database Schema for Supabase
-- Source of Truth: Application Codebase & Business Logic (src/lib/storage.ts & types)
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
    code TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    pin_code TEXT NOT NULL,
    password_hash TEXT,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    default_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('manager', 'employee', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_employees_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_employees_username_not_empty CHECK (length(trim(username)) > 0),
    CONSTRAINT chk_employees_pin_length CHECK (length(trim(pin_code)) >= 4)
);

-- ==============================================================================
-- Table: services (كتالوج الخدمات الحكومية)
-- Description: الخدمات وسرعات التنفيذ (عادي، مستعجل، فوري...) وحقول الإدخال المخصصة
-- ==============================================================================
CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    base_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    execution_days INTEGER NOT NULL DEFAULT 1,
    speeds JSONB NOT NULL DEFAULT '[]'::jsonb,
    fields_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_services_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_services_base_price_positive CHECK (base_price >= 0.00),
    CONSTRAINT chk_services_execution_days CHECK (execution_days >= 0)
);

-- ==============================================================================
-- Table: customers (سجل العملاء)
-- Description: بيانات العملاء المسجلين والبحث بالرقم القومي أو الهاتف
-- ==============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    national_id VARCHAR(14),
    total_orders INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_customers_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_customers_phone_not_empty CHECK (length(trim(phone)) > 0),
    CONSTRAINT chk_customers_total_orders CHECK (total_orders >= 0)
);

-- ==============================================================================
-- Table: distributors (الموزعون والوسطاء الخارجيون)
-- Description: الموزعون الذين تصدر لهم معاملات بالآجل ويقومون بتوريد مبالغ نقدية
-- ==============================================================================
CREATE TABLE IF NOT EXISTS distributors (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_distributors_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_distributors_code_not_empty CHECK (length(trim(code)) > 0)
);

-- ==============================================================================
-- Table: external_offices (المكاتب الخارجية المعاونة)
-- Description: مكاتب الترجمة والتوثيق والتنفيذ الخارجي ذات التكلفة المحددة
-- ==============================================================================
CREATE TABLE IF NOT EXISTS external_offices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT NOT NULL,
    specialty TEXT,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ext_offices_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ==============================================================================
-- Table: expense_categories (بنود وتصنيفات المصروفات)
-- Description: بنود الصرف التشغيلي (إيجار، كهرباء، صيانة، نثريات...)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_expense_cats_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ==============================================================================
-- Table: service_orders (أوامر العمليات والتشغيل)
-- Description: المعاملات الرئيسية متضمنة التفاصيل المالية، الموزع، والمكتب الخارجي
-- ==============================================================================
CREATE TABLE IF NOT EXISTS service_orders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_national_id VARCHAR(14),
    service_id TEXT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    service_name TEXT NOT NULL,
    speed TEXT NOT NULL DEFAULT 'normal',
    form_barcode TEXT,
    form_source TEXT CHECK (form_source IN ('internal', 'external')),
    custom_fields_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delivered', 'cancelled')),
    price NUMERIC(12, 2) NOT NULL,
    total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    distributor_id TEXT REFERENCES distributors(id) ON DELETE SET NULL,
    external_office_id TEXT REFERENCES external_offices(id) ON DELETE SET NULL,
    external_office_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    office_margin NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    creation_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    current_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    delivery_branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    created_by_employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_orders_price_positive CHECK (price >= 0.00),
    CONSTRAINT chk_orders_paid_bounds CHECK (total_paid >= 0.00 AND total_paid <= price),
    CONSTRAINT chk_orders_remaining_math CHECK (remaining = round((price - total_paid)::numeric, 2)),
    CONSTRAINT chk_orders_ext_office_cost CHECK (external_office_cost >= 0.00),
    CONSTRAINT chk_orders_margin_math CHECK (office_margin = round((price - external_office_cost)::numeric, 2))
);

-- ==============================================================================
-- Table: payments (سجل الدفعات والتحصيلات النقدية والإلكترونية)
-- Description: سداد الدفعات الأولى والمتبقي مقسمة بين كاش وإلكتروني (محفظة، إنستاباي، نقاط بيع)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id TEXT NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    cash_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    electronic_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    electronic_type TEXT CHECK (electronic_type IN ('wallet', 'instapay', 'pos') OR electronic_type IS NULL),
    notes TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_payments_amount_positive CHECK (amount > 0.00),
    CONSTRAINT chk_payments_cash_positive CHECK (cash_amount >= 0.00),
    CONSTRAINT chk_payments_electronic_positive CHECK (electronic_amount >= 0.00),
    CONSTRAINT chk_payments_sum_split CHECK (amount = round((cash_amount + electronic_amount)::numeric, 2))
);

-- ==============================================================================
-- Table: cash_ledger (دفتر الأستاذ المالي الملحق بالخزنة النقدية - Append-Only)
-- Description: سجل التدفقات النقدية غير القابل للتعديل لعهدة الموظف وخزينة الفرع
-- ==============================================================================
CREATE TABLE IF NOT EXISTS cash_ledger (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK (
        transaction_type IN (
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
        )
    ),
    amount NUMERIC(12, 2) NOT NULL, -- موجب للمقبوضات، سالب للمصروفات والتحويلات الخارجة
    balance_after NUMERIC(12, 2) NOT NULL,
    reference_table TEXT,
    reference_id TEXT,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Table: distributor_transactions (حركات حسابات ومديونيات الموزعين)
-- Description: قيد المديونية عند تسجيل طلب بالآجل أو السداد والتوريد النقدي
-- ==============================================================================
CREATE TABLE IF NOT EXISTS distributor_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    distributor_id TEXT NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('order_charge', 'supply_payment', 'opening_balance')),
    reference_id TEXT,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    balance_after NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_dist_txns_amount_positive CHECK (amount > 0.00)
);

-- ==============================================================================
-- Table: external_office_transactions (حركات وسدادات المكاتب الخارجية)
-- Description: تتبع مستحقات مكاتب التنفيذ وسداد الدفعات لهم من الخزينة
-- ==============================================================================
CREATE TABLE IF NOT EXISTS external_office_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    external_office_id TEXT NOT NULL REFERENCES external_offices(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('service_order_cost', 'office_payout', 'opening_balance')),
    reference_id TEXT,
    idempotency_key TEXT UNIQUE,
    notes TEXT,
    balance_after NUMERIC(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Table: expenses (المصروفات النقدية للفرع)
-- Description: المصروفات المباشرة المخصومة من الخزينة النقدية للفرع
-- ==============================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    category_id TEXT REFERENCES expense_categories(id) ON DELETE SET NULL,
    category_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    related_order_id TEXT REFERENCES service_orders(id) ON DELETE SET NULL,
    external_office_id TEXT REFERENCES external_offices(id) ON DELETE SET NULL,
    notes TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_expenses_amount_positive CHECK (amount > 0.00)
);

-- ==============================================================================
-- Table: branch_transfers (التحويلات النقدية بين الفروع)
-- Description: تحويل النقد بين الفروع بحالة (pending, completed, rejected)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS branch_transfers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reference_number TEXT UNIQUE NOT NULL,
    from_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    to_branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    sender_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    receiver_employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    notes TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_transfers_amount_positive CHECK (amount > 0.00),
    CONSTRAINT chk_transfers_different_branches CHECK (from_branch_id <> to_branch_id)
);

-- ==============================================================================
-- Table: daily_closings (الإغلاق والتسوية اليومية للخزينة)
-- Description: تسوية الرصيد الدفتري مع الجرد الفعلي، مع منع التكرار لليوم الواحد
-- ==============================================================================
CREATE TABLE IF NOT EXISTS daily_closings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    closing_date DATE NOT NULL,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    system_calculated_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    actual_cash_count NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    closing_type TEXT NOT NULL DEFAULT 'carry_over' CHECK (closing_type IN ('carry_over', 'payout_to_main')),
    total_cash_in NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cash_out NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_electronic NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_cash_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_orders_count INTEGER NOT NULL DEFAULT 0,
    total_expenses_count INTEGER NOT NULL DEFAULT 0,
    employee_name TEXT,
    closing_employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_closing_date UNIQUE (branch_id, closing_date),
    CONSTRAINT chk_closings_actual_cash_positive CHECK (actual_cash_count >= 0.00),
    CONSTRAINT chk_closings_orders_count CHECK (total_orders_count >= 0),
    CONSTRAINT chk_closings_expenses_count CHECK (total_expenses_count >= 0)
);

-- ==============================================================================
-- Table: audit_logs (سجل التتبع والرقابة الشامل - Audit Trail)
-- Description: تسجيل كافة العمليات، التعديلات، وبيانات قبل وبعد التغيير
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    employee_name TEXT NOT NULL,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_name TEXT,
    entity_id TEXT,
    old_data JSONB,
    new_data JSONB,
    changes JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Table: idempotency_keys (سجل مفاتيح عدم التكرار للعمليات المتزامنة)
-- Description: حماية العمليات المالية والتسجيل من التكرار والـ Race Conditions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- ------------------------------------------------------------------------------
-- 3. INDEXES (الاستعلامات السريعة، الفلترة، والبحث عالي الكثافة)
-- ------------------------------------------------------------------------------

-- Customers Indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_national_id ON customers(national_id) WHERE national_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Service Orders Indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON service_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON service_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_national_id ON service_orders(customer_national_id) WHERE customer_national_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_service_id ON service_orders(service_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_current_branch_status ON service_orders(current_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_creation_branch ON service_orders(creation_branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_distributor_id ON service_orders(distributor_id) WHERE distributor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_external_office_id ON service_orders(external_office_id) WHERE external_office_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON service_orders(created_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON service_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_remaining ON service_orders(remaining) WHERE remaining > 0;

-- Unique Barcode Index (Only when barcode is present)
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_form_barcode ON service_orders(form_barcode)
    WHERE form_barcode IS NOT NULL AND form_barcode <> '';

-- Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch_created ON payments(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_employee_created ON payments(employee_id, created_at DESC);

-- Cash Ledger Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_branch_date ON cash_ledger(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_employee_date ON cash_ledger(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_branch_emp_date ON cash_ledger(branch_id, employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_type ON cash_ledger(transaction_type);

-- Expenses Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_employee_date ON expenses(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_order_id ON expenses(related_order_id) WHERE related_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_ext_office ON expenses(external_office_id) WHERE external_office_id IS NOT NULL;

-- Branch Transfers Indexes
CREATE INDEX IF NOT EXISTS idx_transfers_from_branch ON branch_transfers(from_branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_to_branch ON branch_transfers(to_branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON branch_transfers(status);

-- Distributor & External Office Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_dist_txns_dist_id ON distributor_transactions(distributor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ext_office_txns_id ON external_office_transactions(external_office_id, created_at DESC);

-- Daily Closings Indexes
CREATE INDEX IF NOT EXISTS idx_closings_branch_date ON daily_closings(branch_id, closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_closings_employee ON daily_closings(closing_employee_id);

-- Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_logs(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_employee ON audit_logs(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

-- Idempotency Keys Cleanup Index
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ------------------------------------------------------------------------------
-- 4. AUTOMATIC TIMESTAMP UPDATE TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Triggers
DROP TRIGGER IF EXISTS trg_branches_updated_at ON branches;
CREATE TRIGGER trg_branches_updated_at
    BEFORE UPDATE ON branches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_services_updated_at ON services;
CREATE TRIGGER trg_services_updated_at
    BEFORE UPDATE ON services
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
-- 5. ROW LEVEL SECURITY (RLS) & ACCESS POLICIES
-- ------------------------------------------------------------------------------

-- Disable RLS or create permissive policies to allow public/anon client access
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

-- Permissive policies for anon / authenticated roles
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

