-- ==============================================================================
-- منظومة تارجت للخدمات الحكومية
-- Script: add_missing_columns.sql (تحديث الهيكل - Schema Migration)
-- ------------------------------------------------------------------------------
-- PURPOSE:
-- هذا السكربت يقوم بإضافة الأعمدة الجديدة التي تمت برمجتها مؤخراً في التطبيق
-- (مثل الدفع الإلكتروني والنقدي وهامش المكتب) إلى قاعدة بيانات سوبابيز.
-- بدون هذه الأعمدة، يفشل التطبيق في رفع المعاملات الجديدة وتظل حبيسة في جهاز الموظف فقط.
-- ==============================================================================

BEGIN;

-- 1. تحديث جدول service_orders
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_orders' AND column_name = 'cash_amount') THEN 
    ALTER TABLE service_orders ADD COLUMN cash_amount NUMERIC(10,2) DEFAULT 0.0; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_orders' AND column_name = 'electronic_amount') THEN 
    ALTER TABLE service_orders ADD COLUMN electronic_amount NUMERIC(10,2) DEFAULT 0.0; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_orders' AND column_name = 'office_margin') THEN 
    ALTER TABLE service_orders ADD COLUMN office_margin NUMERIC(10,2) DEFAULT 0.0; 
  END IF;
END $$;

-- 2. تحديث جدول payments
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'cash_amount') THEN 
    ALTER TABLE payments ADD COLUMN cash_amount NUMERIC(10,2) DEFAULT 0.0; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'electronic_amount') THEN 
    ALTER TABLE payments ADD COLUMN electronic_amount NUMERIC(10,2) DEFAULT 0.0; 
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'electronic_type') THEN 
    ALTER TABLE payments ADD COLUMN electronic_type TEXT; 
  END IF;
END $$;

COMMIT;

-- ==============================================================================
-- ✅ تم إضافة كافة الأعمدة بنجاح.
-- ==============================================================================
