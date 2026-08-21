-- ==============================================================================
-- منظومة تارجت لإدارة الخدمات الحكومية والتوثيقية | Target Multi-Branch System
-- Script: reset_all_data.sql (تصفير بيانات التشغيل فقط)
-- ------------------------------------------------------------------------------
-- PURPOSE:
-- هذا السكربت يقوم بمسح جميع البيانات التشغيلية والمالية فقط
-- مع الإبقاء التام على البيانات المرجعية الأساسية:
--   ✓ الفروع (branches)
--   ✓ الموظفين (employees)
--   ✓ الموزعين وأرصدتهم (distributors)
--   ✓ المكاتب الخارجية وأرصدتها (external_offices)
--   ✓ كتالوج الخدمات (services)
--   ✓ تصنيفات المصروفات (expense_categories)
-- لا يتم DROP لأي جدول أو تغيير في الـ Schema أو RLS Policies أو Functions.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. سجلات الخزنة والحسابات والمدفوعات (Financial Ledger & Payments)
-- ------------------------------------------------------------------------------
DELETE FROM payments;
DELETE FROM cash_ledger;
DELETE FROM distributor_transactions;
DELETE FROM external_office_transactions;
DELETE FROM expenses;
DELETE FROM branch_transfers;
DELETE FROM daily_closings;
DELETE FROM audit_logs;
DELETE FROM idempotency_keys;

-- ------------------------------------------------------------------------------
-- 2. المعاملات والعملاء (Service Orders & Customers)
-- ------------------------------------------------------------------------------
DELETE FROM service_orders;
DELETE FROM customers;

-- ------------------------------------------------------------------------------
-- 3. إعادة تصفير الأعمدة المالية للموزعين والمكاتب الخارجية
--    (مع الإبقاء التام على أسمائهم وبياناتهم)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  -- 1) تصفير أعمدة جدول الموزعين الموجودة في الـ Database
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'balance') THEN
    EXECUTE 'UPDATE distributors SET balance = 0';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'total_orders_value') THEN
    EXECUTE 'UPDATE distributors SET total_orders_value = 0';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'total_supplied') THEN
    EXECUTE 'UPDATE distributors SET total_supplied = 0';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'distributors' AND column_name = 'balance_due') THEN
    EXECUTE 'UPDATE distributors SET balance_due = 0';
  END IF;

  -- 2) تصفير أعمدة جدول المكاتب الخارجية الموجودة في الـ Database
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_offices' AND column_name = 'balance') THEN
    EXECUTE 'UPDATE external_offices SET balance = 0';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_offices' AND column_name = 'total_jobs_count') THEN
    EXECUTE 'UPDATE external_offices SET total_jobs_count = 0';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'external_offices' AND column_name = 'total_cost_paid') THEN
    EXECUTE 'UPDATE external_offices SET total_cost_paid = 0';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- ✗ البيانات التالية محفوظة ولن تُحذف:
-- ------------------------------------------------------------------------------
-- الفروع              → branches
-- الموظفون            → employees
-- الموزعون            → distributors      (الأرصدة صُفِّرت أعلاه)
-- المكاتب الخارجية   → external_offices   (الأرصدة صُفِّرت أعلاه)
-- كتالوج الخدمات     → services
-- تصنيفات المصروفات  → expense_categories
-- ------------------------------------------------------------------------------

COMMIT;

-- ==============================================================================
-- ✅ تم تصفير البيانات التشغيلية بنجاح مع الحفاظ على جميع البيانات المرجعية
-- ==============================================================================
