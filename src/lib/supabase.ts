import localforage from 'localforage';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Supabase Client Configuration & Hybrid Connection Manager
 */

import { createClient } from '@supabase/supabase-js';
import { storage, getStorageData, setStorageData } from './storage';

const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch {}
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey =
  getEnv('VITE_SUPABASE_ANON_KEY') ||
  getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = (isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null) as any;

// LocalStorage Storage Keys Definition
const STORAGE_KEYS = {
  BRANCHES: 'esnad_branches_v1',
  EMPLOYEES: 'esnad_employees_v1',
  SERVICES: 'esnad_services_v1',
  CUSTOMERS: 'esnad_customers_v1',
  ORDERS: 'esnad_orders_v1',
  PAYMENTS: 'esnad_payments_v1',
  LEDGER: 'esnad_ledger_v1',
  DISTRIBUTORS: 'esnad_distributors_v1',
  DISTRIBUTOR_TXNS: 'esnad_distributor_txns_v1',
  EXTERNAL_OFFICES: 'esnad_external_offices_v1',
  EXTERNAL_OFFICE_TXNS: 'esnad_external_office_txns_v1',
  EXPENSE_CATEGORIES: 'esnad_expense_categories_v1',
  EXPENSES: 'esnad_expenses_v1',
  TRANSFERS: 'esnad_transfers_v1',
  CLOSINGS: 'esnad_closings_v1',
  AUDIT_LOGS: 'esnad_audit_logs_v1',
  IDEMPOTENCY_CACHE: 'esnad_idempotency_cache_v1',
  TOMBSTONES: 'esnad_tombstones_v1',
};

// Helper to load from LocalStorage
function loadLocal<T>(key: string, defaultValue: T): T {
  return getStorageData(key, defaultValue);
}

// Helper to save to LocalStorage
function saveLocal<T>(key: string, value: T): void {
  setStorageData(key, value);
}

// Safe Merge: Keeps local items if they exist locally but not remotely (preventing data loss on failed pushes)
// Supports multi-device sync, normalizes UUIDs, and prevents duplicate records or zombie resurrection
function safeMerge<T extends { id: string; created_at?: string; _synced?: boolean }>(remoteData: T[], localKey: string): T[] {
  const localItems = loadLocal<T[]>(localKey, []);
  const tombstones = getStorageData<string[]>(STORAGE_KEYS.TOMBSTONES, []);

  const tombstoneSet = new Set<string>();
  tombstones.forEach(id => {
    tombstoneSet.add(id);
    const valid = toValidUuid(id);
    if (valid) tombstoneSet.add(valid);
  });

  const mergedMap = new Map<string, T>();
  const remoteKnownIds = new Set<string>();

  // 1. Add remote data (marking as _synced) unless tombstoned
  remoteData.forEach(item => {
    const validId = toValidUuid(item.id) || item.id;
    if (!tombstoneSet.has(item.id) && !tombstoneSet.has(validId)) {
      const normalizedItem = { ...item, id: validId, _synced: true };
      mergedMap.set(validId, normalizedItem);
      remoteKnownIds.add(validId);
      remoteKnownIds.add(item.id);
    }
  });

  // 2. Preserve local items ONLY if neither raw ID nor valid UUID is present in remoteData
  localItems.forEach(localItem => {
    const validLocalId = toValidUuid(localItem.id) || localItem.id;

    const isTombstoned = tombstoneSet.has(localItem.id) || tombstoneSet.has(validLocalId);
    const isAlreadyInRemote = remoteKnownIds.has(localItem.id) || remoteKnownIds.has(validLocalId);

    if (!isTombstoned && !isAlreadyInRemote) {
      mergedMap.set(validLocalId, { ...localItem, id: validLocalId });
    }
  });

  const merged = Array.from(mergedMap.values());
  return merged.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}


// Helper to ensure any custom string ID (e.g. b1-dokki) is formatted as a valid UUID for Postgres UUID columns
export function toValidUuid(val: string | null | undefined): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'none') return null;

  // If already a valid UUID hex format
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  if (isUuid) return str;

  // Convert custom string deterministically to a valid UUID format
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += (str.charCodeAt(i) % 256).toString(16).padStart(2, '0');
  }
  hex = (hex + '0'.repeat(32)).slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface SyncReport {
  success: boolean;
  message: string;
  details?: Record<string, { pushed: number; pulled: number; error?: string }>;
}

/**
 * Supabase Synchronization Service
 * Handles pushing offline/local data to Supabase PostgreSQL database and pulling it back.
 * Completely maps local camelCase object structures to snake_case DB table columns.
 */
export const supabaseSyncService = {
  /**
   * PUSH local storage data into Supabase
   */
  async pushToSupabase(): Promise<SyncReport> {
    if (!supabase) {
      return { success: false, message: 'Supabase is not configured yet. Please check your settings.' };
    }

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false) {
      return { success: false, message: 'الجهاز غير متصل بالإنترنت حالياً. تم حفظ العمليات محلياً وستتم المزامنة تلقائياً عند استعادة الاتصال.' };
    }

    const details: Record<string, { pushed: number; pulled: number; error?: string }> = {};

    const pushTable = async <T>(tableName: string, localKey: string, transformFn: (items: T[]) => any[]) => {
      try {
        const items = loadLocal<T[]>(localKey, []);
        if (items.length > 0) {
          const payload = transformFn(items);
          const { error } = await supabase.from(tableName).upsert(payload);
          if (error) {
            console.warn(`[Sync] Upsert notice on ${tableName}:`, error.message);
            details[tableName] = { pushed: 0, pulled: 0, error: error.message };
          } else {
            details[tableName] = { pushed: items.length, pulled: 0 };
            // Mark pushed items as synced locally and normalize their IDs to valid UUIDs
            const currentItems = loadLocal<T[]>(localKey, []);
            const pushedOriginalIds = new Set(items.map((i: any) => i.id));
            const pushedValidIds = new Set(items.map((i: any) => toValidUuid(i.id) || i.id));

            const updatedMap = new Map<string, any>();
            currentItems.forEach((i: any) => {
              const validId = toValidUuid(i.id) || i.id;
              const isPushed = pushedOriginalIds.has(i.id) || pushedValidIds.has(validId) || pushedValidIds.has(i.id);
              if (!updatedMap.has(validId)) {
                updatedMap.set(validId, {
                  ...i,
                  id: validId,
                  _synced: isPushed ? true : (i._synced ?? false),
                });
              }
            });
            saveLocal(localKey, Array.from(updatedMap.values()));
          }
        } else {
          details[tableName] = { pushed: 0, pulled: 0 };
        }
      } catch (err: any) {
        console.warn(`[Sync] Network/Fetch notice pushing to ${tableName}:`, err?.message || err);
        details[tableName] = { pushed: 0, pulled: 0, error: err?.message || 'Network notice' };
      }
    };

    try {
      // 1. Branches
      await pushTable('branches', STORAGE_KEYS.BRANCHES, (branches: any[]) =>
        branches.map(b => ({
          id: toValidUuid(b.id),
          name: b.name,
          code: b.code,
          phone: b.phone || null,
          address: b.address || null,
          is_active: b.is_active ?? true,
          created_at: b.created_at,
          updated_at: b.updated_at || b.created_at,
        }))
      );

      // 2. Employees
      await pushTable('employees', STORAGE_KEYS.EMPLOYEES, (employees: any[]) =>
        employees.map(e => ({
          id: toValidUuid(e.id),
          name: e.name,
          code: e.code || `EMP-${e.id}`,
          username: e.username || e.email || e.id,
          email: e.email || null,
          phone: e.phone || null,
          pin_code: e.pin_code || e.password || '1234',
          password: e.password || null,
          branch_id: toValidUuid(e.branch_id),
          default_branch_id: toValidUuid(e.default_branch_id),
          role: e.role || 'employee',
          is_active: e.is_active ?? true,
          created_at: e.created_at,
        }))
      );

      // 3. Services
      await pushTable('services', STORAGE_KEYS.SERVICES, (services: any[]) =>
        services.map(s => ({
          id: toValidUuid(s.id),
          name: s.name,
          category: s.category || '',
          base_price: s.base_price,
          execution_days: s.execution_days ?? 1,
          speeds: s.speeds || [],
          fields_config: s.fields_config || [],
          is_active: s.is_active ?? true,
          created_at: s.created_at,
        }))
      );

      // 4. Customers
      await pushTable('customers', STORAGE_KEYS.CUSTOMERS, (customers: any[]) =>
        customers.map(c => ({
          id: toValidUuid(c.id),
          name: c.name,
          phone: c.phone,
          national_id: c.national_id || null,
          total_orders: c.total_orders || 0,
          created_at: c.created_at,
        }))
      );

      // 5. Distributors
      await pushTable('distributors', STORAGE_KEYS.DISTRIBUTORS, (distributors: any[]) =>
        distributors.map(d => ({
          id: toValidUuid(d.id),
          name: d.name,
          phone: d.phone,
          code: d.code,
          address: d.address || null,
          is_active: d.is_active ?? true,
          created_at: d.created_at,
        }))
      );

      // 6. External Offices
      await pushTable('external_offices', STORAGE_KEYS.EXTERNAL_OFFICES, (offices: any[]) =>
        offices.map(o => ({
          id: toValidUuid(o.id),
          name: o.name,
          contact_person: o.contact_person || null,
          phone: o.phone,
          specialty: o.specialty || null,
          address: o.address || null,
          is_active: o.is_active ?? true,
          created_at: o.created_at,
        }))
      );

      // 7. Expense Categories
      await pushTable('expense_categories', STORAGE_KEYS.EXPENSE_CATEGORIES, (categories: any[]) =>
        categories.map(c => ({
          id: toValidUuid(c.id),
          name: c.name,
          is_active: c.is_active ?? true,
          created_at: c.created_at,
        }))
      );

      // 8. Service Orders
      await pushTable('service_orders', STORAGE_KEYS.ORDERS, (orders: any[]) =>
        orders.map(o => ({
          id: toValidUuid(o.id),
          order_number: o.order_number,
          customer_id: toValidUuid(o.customer_id),
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          customer_national_id: o.customer_national_id || null,
          service_id: toValidUuid(o.service_id),
          service_name: o.service_name,
          speed: o.speed || 'normal',
          form_barcode: o.form_barcode || null,
          form_source: o.form_source || null,
          custom_fields_data: o.custom_fields_data || {},
          notes: o.notes || null,
          status: o.status || 'pending',
          price: o.price,
          total_paid: o.total_paid,
          remaining: o.remaining,
          cash_amount: o.cash_amount || 0.0,
          electronic_amount: o.electronic_amount || 0.0,
          distributor_id: toValidUuid(o.distributor_id),
          external_office_id: toValidUuid(o.external_office_id),
          external_office_cost: o.external_office_cost || 0.0,
          office_margin: o.office_margin || 0.0,
          creation_branch_id: toValidUuid(o.creation_branch_id),
          current_branch_id: toValidUuid(o.current_branch_id),
          delivery_branch_id: toValidUuid(o.delivery_branch_id),
          created_by_employee_id: toValidUuid(o.created_by_employee_id),
          idempotency_key: o.idempotency_key,
          created_at: o.created_at,
          updated_at: o.updated_at || o.created_at,
        }))
      );

      // 9. Payments
      await pushTable('payments', STORAGE_KEYS.PAYMENTS, (payments: any[]) =>
        payments.map(p => ({
          id: toValidUuid(p.id),
          order_id: toValidUuid(p.order_id),
          branch_id: toValidUuid(p.branch_id),
          employee_id: toValidUuid(p.employee_id),
          amount: p.amount,
          cash_amount: p.cash_amount ?? p.amount,
          electronic_amount: p.electronic_amount ?? 0,
          electronic_type: p.electronic_type || null,
          notes: p.notes || null,
          idempotency_key: p.idempotency_key,
          created_at: p.created_at,
        }))
      );

      // 10. Cash Ledger
      await pushTable('cash_ledger', STORAGE_KEYS.LEDGER, (ledger: any[]) =>
        ledger.map(l => ({
          id: toValidUuid(l.id),
          branch_id: toValidUuid(l.branch_id),
          employee_id: toValidUuid(l.employee_id),
          transaction_type: l.transaction_type,
          amount: l.amount,
          balance_after: l.balance_after,
          reference_table: l.reference_table || null,
          reference_id: toValidUuid(l.reference_id),
          idempotency_key: l.idempotency_key || null,
          notes: l.notes || null,
          created_at: l.created_at,
        }))
      );

      // 11. Distributor Transactions
      await pushTable('distributor_transactions', STORAGE_KEYS.DISTRIBUTOR_TXNS, (distTxns: any[]) =>
        distTxns.map(t => {
          let type = t.type || 'order_charge';
          if (type === 'payment') type = 'supply_payment';
          if (type === 'charge') type = 'order_charge';
          if (!['order_charge', 'supply_payment', 'opening_balance'].includes(type)) {
            type = 'order_charge';
          }

          const defaultBranchUuid = toValidUuid('b1-dokki');
          const defaultEmpUuid = toValidUuid('emp-1');

          return {
            id: toValidUuid(t.id),
            distributor_id: toValidUuid(t.distributor_id),
            branch_id: toValidUuid(t.branch_id) || defaultBranchUuid,
            employee_id: toValidUuid(t.employee_id) || defaultEmpUuid,
            amount: Math.max(0.01, Math.abs(Number(t.amount || 0))),
            type,
            reference_id: toValidUuid(t.reference_id),
            idempotency_key: t.idempotency_key || null,
            notes: t.notes || null,
            balance_after: t.balance_after ? Number(t.balance_after) : null,
            created_at: t.created_at || new Date().toISOString(),
          };
        })
      );

      // 11b. External Office Transactions
      await pushTable('external_office_transactions', STORAGE_KEYS.EXTERNAL_OFFICE_TXNS, (officeTxns: any[]) =>
        officeTxns.map(t => {
          let type = t.type || 'service_order_cost';
          if (type === 'payout' || type === 'payment') type = 'office_payout';
          if (type === 'cost') type = 'service_order_cost';
          if (!['service_order_cost', 'office_payout', 'opening_balance'].includes(type)) {
            type = 'service_order_cost';
          }

          const defaultBranchUuid = toValidUuid('b1-dokki');
          const defaultEmpUuid = toValidUuid('emp-1');

          return {
            id: toValidUuid(t.id),
            external_office_id: toValidUuid(t.external_office_id),
            branch_id: toValidUuid(t.branch_id) || defaultBranchUuid,
            employee_id: toValidUuid(t.employee_id) || defaultEmpUuid,
            amount: Math.abs(Number(t.amount || 0)),
            type,
            reference_id: toValidUuid(t.reference_id),
            idempotency_key: t.idempotency_key || null,
            notes: t.notes || null,
            balance_after: t.balance_after ? Number(t.balance_after) : 0.0,
            created_at: t.created_at || new Date().toISOString(),
          };
        })
      );

      // 12. Expenses
      await pushTable('expenses', STORAGE_KEYS.EXPENSES, (expenses: any[]) =>
        expenses.map(e => ({
          id: toValidUuid(e.id),
          branch_id: toValidUuid(e.branch_id),
          employee_id: toValidUuid(e.employee_id),
          category_id: toValidUuid(e.category_id),
          category_name: e.category_name || e.category || 'عام',
          amount: e.amount,
          related_order_id: toValidUuid(e.related_order_id),
          external_office_id: toValidUuid(e.external_office_id),
          notes: e.notes || null,
          idempotency_key: e.idempotency_key,
          created_at: e.created_at,
        }))
      );

      // 13. Branch Transfers
      await pushTable('branch_transfers', STORAGE_KEYS.TRANSFERS, (transfers: any[]) =>
        transfers.map(t => ({
          id: toValidUuid(t.id),
          reference_number: t.reference_number || `TX-${t.id}`,
          from_branch_id: toValidUuid(t.from_branch_id),
          to_branch_id: toValidUuid(t.to_branch_id),
          amount: t.amount,
          sender_employee_id: toValidUuid(t.sender_employee_id || t.employee_id),
          receiver_employee_id: toValidUuid(t.receiver_employee_id),
          status: t.status || 'pending',
          notes: t.notes || null,
          idempotency_key: t.idempotency_key,
          created_at: t.created_at,
        }))
      );

      // 14. Daily Closings
      await pushTable('daily_closings', STORAGE_KEYS.CLOSINGS, (closings: any[]) =>
        closings.map(c => ({
          id: toValidUuid(c.id),
          branch_id: toValidUuid(c.branch_id),
          closing_date: c.closing_date,
          opening_balance: c.opening_balance || 0.0,
          system_calculated_balance: c.system_calculated_balance,
          actual_cash_count: c.actual_cash_count,
          difference: c.difference,
          closing_type: c.closing_type || 'carry_over',
          total_cash_in: c.total_cash_in || 0.0,
          total_cash_out: c.total_cash_out || 0.0,
          total_electronic: c.total_electronic || 0.0,
          net_cash_balance: c.net_cash_balance || 0.0,
          total_orders_count: c.total_orders_count || 0,
          total_expenses_count: c.total_expenses_count || 0,
          employee_name: c.employee_name || null,
          closing_employee_id: toValidUuid(c.closing_employee_id),
          notes: c.notes || null,
          created_at: c.created_at,
        }))
      );

      // 15. Audit Logs
      await pushTable('audit_logs', STORAGE_KEYS.AUDIT_LOGS, (auditLogs: any[]) =>
        auditLogs.map(a => ({
          id: toValidUuid(a.id),
          employee_id: toValidUuid(a.employee_id),
          employee_name: a.employee_name,
          branch_id: toValidUuid(a.branch_id),
          action: a.action,
          entity: a.entity || 'General',
          entity_name: a.entity_name || null,
          entity_id: a.entity_id || null,
          old_data: a.old_data || null,
          new_data: a.new_data || null,
          changes: a.changes || null,
          metadata: a.metadata || {},
          created_at: a.created_at,
        }))
      );

      // 16. Idempotency Cache Record (optional transient cache)
      try {
        const cache = loadLocal<Record<string, string>>(STORAGE_KEYS.IDEMPOTENCY_CACHE, {});
        const cacheEntries = Object.entries(cache);
        if (cacheEntries.length > 0) {
          const formattedCache = cacheEntries.map(([key, value]) => {
            let parsed: any = null;
            try {
              parsed = JSON.parse(value);
            } catch {
              parsed = { value };
            }
            return {
              key,
              resource_type: key.startsWith('pmt') ? 'payment' : 'order',
              response_payload: parsed,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            };
          });

          const { error } = await supabase.from('idempotency_keys').upsert(formattedCache);
          details['idempotency_keys'] = { pushed: formattedCache.length, pulled: 0, error: error?.message };
        }
      } catch (cacheErr: any) {
        console.warn('[Sync] Optional idempotency_keys push skipped/notice:', cacheErr?.message || cacheErr);
      }

      const hasErrors = Object.values(details).some(d => d.error);
      return {
        success: !hasErrors,
        message: hasErrors ? 'تم الرفع جزئياً مع وجود بعض الملاحظات.' : 'تم رفع ومزامنة كامل البيانات بنجاح إلى قاعدة بيانات سوبابيز سحابياً!',
        details,
      };
    } catch (err: any) {
      console.warn('Push to Supabase completed with notice:', err?.message || err);
      return { success: false, message: `فشلت عملية الرفع سحابياً: ${err.message || err}`, details };
    }
  },

  /**
   * PULL data from Supabase and merge/replace localStorage
   */
  async pullFromSupabase(): Promise<SyncReport> {
    if (!supabase) {
      return { success: false, message: 'Supabase is not configured yet. Please check your settings.' };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, message: 'الجهاز غير متصل بالإنترنت حالياً. يتم العمل على قاعدة البيانات المحلية بأمان تام.' };
    }

    const details: Record<string, { pushed: number; pulled: number; error?: string }> = {};

    try {
      // Helper function to safely fetch table data without throwing unhandled exceptions
      const fetchTable = async (table: string, columns = '*', optional = false) => {
        try {
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            return null;
          }
          const { data, error } = await supabase.from(table).select(columns);
          if (error) {
            if (optional) {
              console.warn(`[Sync] Optional table ${table} not available:`, error.message);
            } else {
              console.warn(`[Sync] Table ${table} fetch notice:`, error.message);
            }
            details[table] = { pushed: 0, pulled: 0, error: error.message };
            return null;
          }
          return data || [];
        } catch (fetchErr: any) {
          const errMsg = fetchErr?.message || String(fetchErr);
          if (optional) {
            console.warn(`[Sync] Optional table ${table} network notice (ignored):`, errMsg);
          } else {
            console.warn(`[Sync] Table ${table} network/fetch notice:`, errMsg);
          }
          details[table] = { pushed: 0, pulled: 0, error: errMsg };
          return null;
        }
      };

      // 0. Detect Global Wipe (If both branches and employees are empty on server but exist locally)
      const dbBranches = await fetchTable('branches');
      const dbEmployees = await fetchTable('employees');

      const currentLocalBranches = loadLocal<any[]>(STORAGE_KEYS.BRANCHES, []);
      const currentLocalEmployees = loadLocal<any[]>(STORAGE_KEYS.EMPLOYEES, []);

      if (
        Array.isArray(dbBranches) &&
        Array.isArray(dbEmployees) &&
        dbBranches.length === 0 &&
        dbEmployees.length === 0 &&
        (currentLocalBranches.length > 0 || currentLocalEmployees.length > 0)
      ) {
        console.warn('[Sync] Detected empty core tables (branches & employees). Assuming COMPLETE DB RESET via SQL. Wiping all local data.');
        await storage.clearAllLocalData();
        
        // Return immediately so we don't try to merge anything, the app will redirect to login (or reload).
        if (typeof window !== 'undefined') {
          setTimeout(() => window.location.reload(), 1500);
        }
        return { success: true, message: 'تم مسح القاعدة السحابية. يتم الآن مسح كافة البيانات المحلية وتحديث النظام.' };
      }

      // 1. Pull branches
      if (dbBranches && Array.isArray(dbBranches)) {
        const localBranches = dbBranches.map(b => ({
          id: b.id,
          name: b.name,
          code: b.code,
          phone: b.phone || undefined,
          address: b.address || undefined,
          is_active: b.is_active,
          created_at: b.created_at,
          updated_at: b.updated_at,
        }));
        saveLocal(STORAGE_KEYS.BRANCHES, safeMerge(localBranches, STORAGE_KEYS.BRANCHES));
        details['branches'] = { pushed: 0, pulled: dbBranches.length };
      }

      // 2. Pull employees
      if (dbEmployees && Array.isArray(dbEmployees)) {
        const localEmployees = dbEmployees.map(e => ({
          id: e.id,
          name: e.name,
          code: e.code,
          username: e.username,
          email: e.email || undefined,
          phone: e.phone || undefined,
          pin_code: e.pin_code,
          password: e.password_hash || undefined,
          branch_id: e.branch_id || undefined,
          default_branch_id: e.default_branch_id || undefined,
          role: e.role,
          is_active: e.is_active,
          created_at: e.created_at,
        }));
        saveLocal(STORAGE_KEYS.EMPLOYEES, safeMerge(localEmployees, STORAGE_KEYS.EMPLOYEES));
        details['employees'] = { pushed: 0, pulled: dbEmployees.length };
      }

      // 3. Pull services
      const dbServices = await fetchTable('services');
      if (dbServices && Array.isArray(dbServices)) {
        const localServices = dbServices.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          speeds: s.speeds || [],
          fields_config: s.fields_config || [],
          base_price: Number(s.base_price),
          execution_days: s.execution_days,
          is_active: s.is_active,
          created_at: s.created_at,
        }));
        saveLocal(STORAGE_KEYS.SERVICES, safeMerge(localServices, STORAGE_KEYS.SERVICES));
        details['services'] = { pushed: 0, pulled: dbServices.length };
      }

      // 4. Pull customers
      const dbCustomers = await fetchTable('customers');
      if (dbCustomers && Array.isArray(dbCustomers)) {
        const localCustomers = dbCustomers.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          national_id: c.national_id || undefined,
          total_orders: c.total_orders,
          created_at: c.created_at,
        }));
        saveLocal(STORAGE_KEYS.CUSTOMERS, safeMerge(localCustomers, STORAGE_KEYS.CUSTOMERS));
        details['customers'] = { pushed: 0, pulled: dbCustomers.length };
      }

      // 5. Pull distributors
      const dbDistributors = await fetchTable('distributors');
      if (dbDistributors && Array.isArray(dbDistributors)) {
        const localDistributors = dbDistributors.map(d => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          code: d.code,
          address: d.address || undefined,
          is_active: d.is_active,
          created_at: d.created_at,
        }));
        saveLocal(STORAGE_KEYS.DISTRIBUTORS, safeMerge(localDistributors, STORAGE_KEYS.DISTRIBUTORS));
        details['distributors'] = { pushed: 0, pulled: dbDistributors.length };
      }

      // 6. Pull external offices
      const dbOffices = await fetchTable('external_offices');
      if (dbOffices && Array.isArray(dbOffices)) {
        const localOffices = dbOffices.map(o => ({
          id: o.id,
          name: o.name,
          contact_person: o.contact_person || undefined,
          phone: o.phone,
          specialty: o.specialty || undefined,
          address: o.address || undefined,
          is_active: o.is_active,
          created_at: o.created_at,
        }));
        saveLocal(STORAGE_KEYS.EXTERNAL_OFFICES, safeMerge(localOffices, STORAGE_KEYS.EXTERNAL_OFFICES));
        details['external_offices'] = { pushed: 0, pulled: dbOffices.length };
      }

      // 7. Pull expense categories
      const dbCategories = await fetchTable('expense_categories');
      if (dbCategories && Array.isArray(dbCategories)) {
        const localCategories = dbCategories.map(c => ({
          id: c.id,
          name: c.name,
          is_active: c.is_active,
          created_at: c.created_at,
        }));
        saveLocal(STORAGE_KEYS.EXPENSE_CATEGORIES, safeMerge(localCategories, STORAGE_KEYS.EXPENSE_CATEGORIES));
        details['expense_categories'] = { pushed: 0, pulled: dbCategories.length };
      }

      // 8. Pull service orders & 10. cash ledger (for wipe detection)
      const dbOrders = await fetchTable('service_orders');
      const dbLedger = await fetchTable('cash_ledger');

      // Detect Database Reset via SQL only if both queries succeeded with valid empty arrays
      const currentLocalOrders = loadLocal<any[]>(STORAGE_KEYS.ORDERS, []);
      if (
        Array.isArray(dbOrders) &&
        Array.isArray(dbLedger) &&
        dbOrders.length === 0 &&
        dbLedger.length === 0 &&
        currentLocalOrders.length > 0
      ) {
        console.warn('[Sync] Detected empty transactional tables. Assuming DB reset via SQL. Wiping local transactions.');
        saveLocal(STORAGE_KEYS.ORDERS, []);
        saveLocal(STORAGE_KEYS.PAYMENTS, []);
        saveLocal(STORAGE_KEYS.LEDGER, []);
        saveLocal(STORAGE_KEYS.DISTRIBUTOR_TXNS, []);
        saveLocal(STORAGE_KEYS.EXTERNAL_OFFICE_TXNS, []);
        saveLocal(STORAGE_KEYS.EXPENSES, []);
        saveLocal(STORAGE_KEYS.TRANSFERS, []);
        saveLocal(STORAGE_KEYS.CLOSINGS, []);
        saveLocal(STORAGE_KEYS.AUDIT_LOGS, []);
        saveLocal(STORAGE_KEYS.IDEMPOTENCY_CACHE, {});
        return { success: true, message: 'تم اكتشاف تصفير قاعدة البيانات السحابية. تم مسح العمليات المحلية بنجاح.' };
      }

      if (dbOrders && Array.isArray(dbOrders)) {
        const localOrders = dbOrders.map(o => ({
          id: o.id,
          order_number: o.order_number,
          customer_id: o.customer_id,
          customer_name: o.customer_name,
          customer_phone: o.customer_phone,
          customer_national_id: o.customer_national_id || undefined,
          service_id: o.service_id,
          service_name: o.service_name,
          speed: o.speed,
          form_barcode: o.form_barcode || undefined,
          form_source: o.form_source || undefined,
          custom_fields_data: o.custom_fields_data || {},
          notes: o.notes || undefined,
          status: o.status,
          price: Number(o.price),
          total_paid: Number(o.total_paid),
          remaining: Number(o.remaining),
          cash_amount: Number(o.cash_amount || 0),
          electronic_amount: Number(o.electronic_amount || 0),
          distributor_id: o.distributor_id,
          external_office_id: o.external_office_id,
          external_office_cost: Number(o.external_office_cost),
          office_margin: Number(o.office_margin),
          creation_branch_id: o.creation_branch_id,
          current_branch_id: o.current_branch_id,
          delivery_branch_id: o.delivery_branch_id,
          created_by_employee_id: o.created_by_employee_id,
          idempotency_key: o.idempotency_key,
          created_at: o.created_at,
          updated_at: o.updated_at,
        }));
        saveLocal(STORAGE_KEYS.ORDERS, safeMerge(localOrders, STORAGE_KEYS.ORDERS));
        details['service_orders'] = { pushed: 0, pulled: dbOrders.length };
      }

      // 9. Pull payments
      const dbPayments = await fetchTable('payments');
      if (dbPayments && Array.isArray(dbPayments)) {
        const localPayments = dbPayments.map(p => ({
          id: p.id,
          order_id: p.order_id,
          branch_id: p.branch_id,
          employee_id: p.employee_id,
          amount: Number(p.amount),
          cash_amount: Number(p.cash_amount),
          electronic_amount: Number(p.electronic_amount),
          electronic_type: p.electronic_type,
          notes: p.notes || undefined,
          idempotency_key: p.idempotency_key,
          created_at: p.created_at,
        }));
        saveLocal(STORAGE_KEYS.PAYMENTS, safeMerge(localPayments, STORAGE_KEYS.PAYMENTS));
        details['payments'] = { pushed: 0, pulled: dbPayments.length };
      }

      // 10. Pull cash ledger (already fetched above for wipe detection)
      if (dbLedger && Array.isArray(dbLedger)) {
        const localLedger = dbLedger.map(l => ({
          id: l.id,
          branch_id: l.branch_id,
          employee_id: l.employee_id || undefined,
          transaction_type: l.transaction_type,
          amount: Number(l.amount),
          balance_after: Number(l.balance_after),
          reference_table: l.reference_table || undefined,
          reference_id: l.reference_id || undefined,
          idempotency_key: l.idempotency_key || undefined,
          notes: l.notes || undefined,
          created_at: l.created_at,
        }));
        saveLocal(STORAGE_KEYS.LEDGER, safeMerge(localLedger, STORAGE_KEYS.LEDGER));
        details['cash_ledger'] = { pushed: 0, pulled: dbLedger.length };
      }

      // 11. Pull distributor transactions
      const dbDistTxns = await fetchTable('distributor_transactions');
      if (dbDistTxns && Array.isArray(dbDistTxns)) {
        const localDistTxns = dbDistTxns.map(t => ({
          id: t.id,
          distributor_id: t.distributor_id,
          branch_id: t.branch_id || undefined,
          employee_id: t.employee_id || undefined,
          amount: Number(t.amount),
          type: t.type,
          reference_id: t.reference_id || undefined,
          idempotency_key: t.idempotency_key || undefined,
          notes: t.notes || undefined,
          balance_after: t.balance_after ? Number(t.balance_after) : undefined,
          created_at: t.created_at,
        }));
        saveLocal(STORAGE_KEYS.DISTRIBUTOR_TXNS, safeMerge(localDistTxns, STORAGE_KEYS.DISTRIBUTOR_TXNS));
        details['distributor_transactions'] = { pushed: 0, pulled: dbDistTxns.length };
      }

      // 11b. Pull external office transactions
      const dbOfficeTxns = await fetchTable('external_office_transactions');
      if (dbOfficeTxns && Array.isArray(dbOfficeTxns)) {
        const localOfficeTxns = dbOfficeTxns.map(t => ({
          id: t.id,
          external_office_id: t.external_office_id,
          branch_id: t.branch_id || undefined,
          employee_id: t.employee_id || undefined,
          amount: Number(t.amount),
          type: t.type,
          reference_id: t.reference_id || undefined,
          idempotency_key: t.idempotency_key || undefined,
          notes: t.notes || undefined,
          balance_after: Number(t.balance_after),
          created_at: t.created_at,
        }));
        saveLocal(STORAGE_KEYS.EXTERNAL_OFFICE_TXNS, safeMerge(localOfficeTxns, STORAGE_KEYS.EXTERNAL_OFFICE_TXNS));
        details['external_office_transactions'] = { pushed: 0, pulled: dbOfficeTxns.length };
      }

      // 12. Pull expenses
      const dbExpenses = await fetchTable('expenses');
      if (dbExpenses && Array.isArray(dbExpenses)) {
        const localExpenses = dbExpenses.map(e => ({
          id: e.id,
          branch_id: e.branch_id,
          employee_id: e.employee_id,
          category_id: e.category_id,
          category_name: e.category_name,
          amount: Number(e.amount),
          related_order_id: e.related_order_id,
          external_office_id: e.external_office_id,
          notes: e.notes || undefined,
          idempotency_key: e.idempotency_key,
          created_at: e.created_at,
        }));
        saveLocal(STORAGE_KEYS.EXPENSES, safeMerge(localExpenses, STORAGE_KEYS.EXPENSES));
        details['expenses'] = { pushed: 0, pulled: dbExpenses.length };
      }

      // 13. Pull branch transfers
      const dbTransfers = await fetchTable('branch_transfers');
      if (dbTransfers && Array.isArray(dbTransfers)) {
        const localTransfers = dbTransfers.map(t => ({
          id: t.id,
          reference_number: t.reference_number || undefined,
          from_branch_id: t.from_branch_id,
          to_branch_id: t.to_branch_id,
          amount: Number(t.amount),
          sender_employee_id: t.sender_employee_id || undefined,
          receiver_employee_id: t.receiver_employee_id || undefined,
          status: t.status,
          notes: t.notes || undefined,
          idempotency_key: t.idempotency_key,
          created_at: t.created_at,
        }));
        saveLocal(STORAGE_KEYS.TRANSFERS, safeMerge(localTransfers, STORAGE_KEYS.TRANSFERS));
        details['branch_transfers'] = { pushed: 0, pulled: dbTransfers.length };
      }

      // 14. Pull daily closings
      const dbClosings = await fetchTable('daily_closings');
      if (dbClosings && Array.isArray(dbClosings)) {
        const localClosings = dbClosings.map(c => ({
          id: c.id,
          branch_id: c.branch_id,
          closing_date: c.closing_date,
          opening_balance: c.opening_balance ? Number(c.opening_balance) : undefined,
          system_calculated_balance: Number(c.system_calculated_balance),
          actual_cash_count: Number(c.actual_cash_count),
          difference: Number(c.difference),
          closing_type: c.closing_type,
          total_cash_in: c.total_cash_in ? Number(c.total_cash_in) : undefined,
          total_cash_out: c.total_cash_out ? Number(c.total_cash_out) : undefined,
          total_electronic: c.total_electronic ? Number(c.total_electronic) : undefined,
          net_cash_balance: c.net_cash_balance ? Number(c.net_cash_balance) : undefined,
          total_orders_count: c.total_orders_count,
          total_expenses_count: c.total_expenses_count,
          employee_name: c.employee_name || undefined,
          closing_employee_id: c.closing_employee_id || undefined,
          notes: c.notes || undefined,
          created_at: c.created_at,
        }));
        saveLocal(STORAGE_KEYS.CLOSINGS, safeMerge(localClosings, STORAGE_KEYS.CLOSINGS));
        details['daily_closings'] = { pushed: 0, pulled: dbClosings.length };
      }

      // 15. Pull audit logs
      const dbAuditLogs = await fetchTable('audit_logs');
      if (dbAuditLogs && Array.isArray(dbAuditLogs)) {
        const localAuditLogs = dbAuditLogs.map(a => ({
          id: a.id,
          employee_id: a.employee_id || undefined,
          employee_name: a.employee_name,
          branch_id: a.branch_id || undefined,
          action: a.action,
          entity: a.entity,
          entity_name: a.entity_name || undefined,
          entity_id: a.entity_id || undefined,
          old_data: a.old_data,
          new_data: a.new_data,
          changes: a.changes,
          metadata: a.metadata || {},
          created_at: a.created_at,
        }));
        saveLocal(STORAGE_KEYS.AUDIT_LOGS, safeMerge(localAuditLogs, STORAGE_KEYS.AUDIT_LOGS));
        details['audit_logs'] = { pushed: 0, pulled: dbAuditLogs.length };
      }

      // 16. Pull idempotency cache (optional transient cache)
      const dbIdempotency = await fetchTable('idempotency_keys', '*', true);
      if (dbIdempotency && Array.isArray(dbIdempotency) && dbIdempotency.length > 0) {
        const localCache: Record<string, string> = {};
        dbIdempotency.forEach(item => {
          localCache[item.key] = typeof item.response_payload === 'string'
            ? item.response_payload
            : JSON.stringify(item.response_payload);
        });
        saveLocal(STORAGE_KEYS.IDEMPOTENCY_CACHE, localCache);
        details['idempotency_keys'] = { pushed: 0, pulled: dbIdempotency.length };
      }

      const totalPulled = Object.values(details).reduce((sum, d) => sum + d.pulled, 0);
      const hasErrors = Object.values(details).some(d => d.error);

      return {
        success: totalPulled > 0 || !hasErrors,
        message: hasErrors
          ? 'تم التحقق من البيانات مع تعذر الاتصال ببعض الجداول، وتم الحفاظ على البيانات المحلية النشطة بأمان.'
          : 'تم سحب وتحديث كامل البيانات من قاعدة سوبابيز السحابية إلى التطبيق بنجاح!',
        details,
      };
    } catch (err: any) {
      console.warn('Pull from Supabase completed with notice:', err?.message || err);
      return {
        success: false,
        message: `تعذر إتمام المزامنة السحابية (${err.message || err}). تم الاعتماد على قاعدة البيانات المحلية النشطة.`,
        details,
      };
    }
  }
};

let autoPushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Triggers a debounced background sync push to Supabase whenever local data is modified.
 */
export async function deleteRecord(table: string, id: string): Promise<void> {
  if (!supabase || typeof window === 'undefined') return;
  try {
    const validUuid = toValidUuid(id) || id;
    const { error } = await supabase.from(table).delete().eq('id', validUuid);
    if (error) {
      console.error(`Error deleting from ${table}:`, error);
    }
  } catch (err) {
    console.error(`Failed to delete ${id} from ${table}:`, err);
  }
}

export function triggerAutoPush(delayMs = 1000): void {
  if (!isSupabaseConfigured || typeof window === 'undefined') return;

  if (autoPushTimer) {
    clearTimeout(autoPushTimer);
  }

  autoPushTimer = setTimeout(() => {
    supabaseSyncService.pushToSupabase().then(res => {
      if (res.success) {
        console.log('[AutoSync] Background push completed successfully');
      } else {
        console.warn('[AutoSync] Background push completed with warnings/errors:', res.message);
      }
    }).catch(err => {
      console.error('[AutoSync] Background push failed silently:', err);
    });
  }, delayMs);
}

/**
 * Subscribes to real-time Postgres changes in Supabase.
 * Whenever a manual or external change occurs in Supabase database tables,
 * this listener automatically pulls the latest changes and refreshes the application.
 */
export function subscribeToRealtimeChanges(onDataChanged: () => void): () => void {
  if (!isSupabaseConfigured || !supabase || typeof window === 'undefined') {
    return () => {};
  }

  try {
    const channel = supabase
      .channel('public:realtime_db_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        async (payload: any) => {
          console.log('[Realtime] DB change detected in table:', payload.table, payload.eventType);
          try {
            await supabaseSyncService.pullFromSupabase();
            onDataChanged();
          } catch (err) {
            console.error('[Realtime] Auto-pull after DB change failed:', err);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected & listening to Supabase live changes!');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error('[Realtime] Subscription error:', err);
    return () => {};
  }
}

/**
 * Completely clears all local storage data keys.
 */

export async function clearAllLocalData(): Promise<void> {
  if (typeof window === 'undefined') return;
  await Promise.all(Object.values(STORAGE_KEYS).map(async (key) => {
    localStorage.removeItem(key);
    await localforage.removeItem(key);
  }));
}


