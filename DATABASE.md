# مخطط وتصميم قاعدة البيانات | Database Architecture (Supabase / PostgreSQL)

## 1. الجداول الأساسية (Core Tables)

### 1. `branches` (الفروع)
- `id` (UUID, Primary Key)
- `name` (TEXT, NOT NULL)
- `code` (TEXT, UNIQUE, NOT NULL)
- `phone` (TEXT)
- `address` (TEXT)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 2. `employees` (الموظفون)
- `id` (UUID, Primary Key)
- `name` (TEXT, NOT NULL)
- `code` (TEXT, UNIQUE, NOT NULL)
- `pin_code` (TEXT, NOT NULL)
- `default_branch_id` (UUID, REFERENCES branches(id))
- `role` (TEXT, DEFAULT 'employee')
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 3. `services` (الخدمات وإعداداتها)
- `id` (UUID, Primary Key)
- `name` (TEXT, NOT NULL)
- `category` (TEXT, NOT NULL)
- `speeds` (JSONB, NOT NULL) -- [{ speed_code, label, price_multiplier, additional_cost }]
- `fields_config` (JSONB, DEFAULT '[]'::jsonb) -- Dynamic fields definition
- `base_price` (NUMERIC(12,2), NOT NULL, CHECK (base_price >= 0))
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 4. `customers` (العملاء)
- `id` (UUID, Primary Key)
- `name` (TEXT, NOT NULL)
- `phone` (TEXT, NOT NULL)
- `national_id` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 5. `service_orders` (أوامر العمليات)
- `id` (UUID, Primary Key)
- `order_number` (TEXT, UNIQUE, NOT NULL)
- `customer_id` (UUID, REFERENCES customers(id))
- `customer_name` (TEXT, NOT NULL)
- `customer_phone` (TEXT, NOT NULL)
- `customer_national_id` (TEXT)
- `service_id` (UUID, REFERENCES services(id))
- `service_name` (TEXT, NOT NULL)
- `speed` (TEXT, NOT NULL)
- `form_barcode` (TEXT)
- `form_source` (TEXT, CHECK (form_source IN ('internal', 'external')))
- `custom_fields_data` (JSONB, DEFAULT '{}'::jsonb)
- `notes` (TEXT)
- `status` (TEXT, DEFAULT 'pending', CHECK (status IN ('pending', 'in_progress', 'completed', 'delivered', 'cancelled')))
- `price` (NUMERIC(12,2), NOT NULL, CHECK (price >= 0))
- `total_paid` (NUMERIC(12,2), NOT NULL DEFAULT 0, CHECK (total_paid >= 0))
- `remaining` (NUMERIC(12,2), NOT NULL, CHECK (remaining >= 0))
- `distributor_id` (UUID, REFERENCES distributors(id))
- `external_office_id` (UUID, REFERENCES external_offices(id))
- `external_office_cost` (NUMERIC(12,2), DEFAULT 0, CHECK (external_office_cost >= 0))
- `office_margin` (NUMERIC(12,2), DEFAULT 0)
- `creation_branch_id` (UUID, REFERENCES branches(id), NOT NULL)
- `current_branch_id` (UUID, REFERENCES branches(id), NOT NULL)
- `delivery_branch_id` (UUID, REFERENCES branches(id))
- `created_by_employee_id` (UUID, REFERENCES employees(id), NOT NULL)
- `idempotency_key` (TEXT, UNIQUE, NOT NULL)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

### 6. `payments` (دفعات التحصيل)
- `id` (UUID, Primary Key)
- `order_id` (UUID, REFERENCES service_orders(id), NOT NULL)
- `branch_id` (UUID, REFERENCES branches(id), NOT NULL)
- `employee_id` (UUID, REFERENCES employees(id), NOT NULL)
- `amount` (NUMERIC(12,2), NOT NULL, CHECK (amount > 0))
- `cash_amount` (NUMERIC(12,2), NOT NULL DEFAULT 0, CHECK (cash_amount >= 0))
- `electronic_amount` (NUMERIC(12,2), NOT NULL DEFAULT 0, CHECK (electronic_amount >= 0))
- `electronic_type` (TEXT, CHECK (electronic_type IN ('wallet', 'instapay', 'pos', NULL)))
- `notes` (TEXT)
- `idempotency_key` (TEXT, UNIQUE, NOT NULL)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 7. `distributors` & `distributor_transactions` (الموزعون وتوريداتهم)
- `distributors`: `id`, `name`, `phone`, `code`, `is_active`, `created_at`
- `distributor_transactions`: `id`, `distributor_id`, `branch_id`, `employee_id`, `amount`, `type` ('order_charge', 'supply_payment'), `reference_id`, `idempotency_key`, `created_at`

### 8. `external_offices` (المكاتب الخارجية)
- `id`, `name`, `contact_person`, `phone`, `is_active`, `created_at`

### 9. `expense_categories` & `expenses` (المصروفات)
- `expense_categories`: `id`, `name`, `is_active`, `created_at`
- `expenses`: `id`, `branch_id`, `employee_id`, `category_id`, `category_name`, `amount` (NUMERIC(12,2)), `related_order_id`, `external_office_id`, `notes`, `idempotency_key`, `created_at`

### 10. `branch_transfers` (التحويلات بين الفروع)
- `id`, `reference_number`, `from_branch_id`, `to_branch_id`, `amount` (NUMERIC(12,2)), `employee_id`, `status` ('completed', 'rejected'), `notes`, `idempotency_key`, `created_at`

### 11. `cash_ledger` (سجل الخزنة المالي للفرع)
- `id` (UUID, Primary Key)
- `branch_id` (UUID, REFERENCES branches(id), NOT NULL)
- `transaction_type` (TEXT, NOT NULL)
- `amount` (NUMERIC(12,2), NOT NULL) -- positive for IN, negative for OUT
- `balance_after` (NUMERIC(12,2), NOT NULL)
- `reference_table` (TEXT)
- `reference_id` (UUID)
- `employee_id` (UUID, REFERENCES employees(id))
- `idempotency_key` (TEXT, UNIQUE)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

### 12. `daily_closings` (الإغلاق والتسوية اليومية)
- `id`, `branch_id`, `closing_date` (DATE, NOT NULL), `opening_balance`, `total_cash_in`, `total_cash_out`, `total_electronic`, `net_cash_balance`, `total_orders_count`, `total_expenses_count`, `closing_employee_id`, `notes`, `created_at`
- **Unique Constraint**: `UNIQUE(branch_id, closing_date)`

### 13. `audit_logs` (سجل الأحداث والرقابة)
- `id`, `employee_id`, `employee_name`, `branch_id`, `action`, `entity`, `entity_id`, `old_data`, `new_data`, `metadata`, `created_at`

---

## 2. الفهارس (Indexes)
- `CREATE INDEX idx_orders_customer_phone ON service_orders(customer_phone);`
- `CREATE INDEX idx_orders_customer_national_id ON service_orders(customer_national_id);`
- `CREATE INDEX idx_orders_form_barcode ON service_orders(form_barcode);`
- `CREATE INDEX idx_orders_order_number ON service_orders(order_number);`
- `CREATE INDEX idx_orders_branch_status ON service_orders(current_branch_id, status);`
- `CREATE INDEX idx_cash_ledger_branch_date ON cash_ledger(branch_id, created_at);`
