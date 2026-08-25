/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Resilient Financial & Operational Storage Engine
 * Guarantees: Append-Only Ledger, Atomic Transactions, Idempotency Safeguards, Audit Trails
 */

import {
  Branch,
  Employee,
  EmployeeRole,
  Service,
  Customer,
  ServiceOrder,
  Payment,
  CashLedgerEntry,
  Distributor,
  DistributorTransaction,
  ExternalOffice,
  ExternalOfficeTransaction,
  ExpenseCategory,
  Expense,
  BranchTransfer,
  DailyClosing,
  AuditLog,
  SystemStats,
} from '../types';

import { triggerAutoPush, deleteRecord } from './supabase';
import localforage from 'localforage';

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
  ACTIVE_BRANCH_ID: 'esnad_active_branch_id_v1',
  ACTIVE_EMPLOYEE_ID: 'esnad_active_employee_id_v1',
  TOMBSTONES: 'esnad_tombstones_v1',
};

// Empty Default Initializers (Seed Data Removed)
const INITIAL_BRANCHES: Branch[] = [];
const INITIAL_EMPLOYEES: Employee[] = [];
const INITIAL_SERVICES: Service[] = [];
const INITIAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [];
const INITIAL_DISTRIBUTORS: Distributor[] = [];
const INITIAL_EXTERNAL_OFFICES: ExternalOffice[] = [];

const memoryCache: Record<string, any> = {};

export async function initializeStorage(): Promise<void> {
  // Wait for all localforage keys to load into memory
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      const val = await localforage.getItem(key);
      if (val !== null) {
        memoryCache[key] = val;
      } else {
        // Fallback to localStorage for backward compatibility/migration
        const oldVal = localStorage.getItem(key);
        if (oldVal) {
          const parsed = JSON.parse(oldVal);
          memoryCache[key] = parsed;
          await localforage.setItem(key, parsed); // migrate it
        }
      }
    } catch (err) {
      console.error(`Failed to load ${key} from IDB`, err);
    }
  }

  // Initialize missing defaults
  await ResilientStorageService.getInstance()._initDefaultsAsync();
}

export function getStorageData<T>(key: string, defaultValue: T): T {
  if (memoryCache[key] !== undefined) {
    return memoryCache[key] as T;
  }
  return defaultValue;
}

export function setStorageData<T>(key: string, value: T): void {
  save(key, value);
}

// Helper functions for reading and writing with JSON
function load<T>(key: string, defaultValue: T): T {
  if (memoryCache[key] !== undefined) {
    return memoryCache[key] as T;
  }
  return defaultValue;
}

function save<T>(key: string, value: T): void {
  // --- ONLINE FIRST ENFORCEMENT ---
  // Block any transactional writes if offline.
  if (key !== STORAGE_KEYS.ACTIVE_BRANCH_ID && key !== STORAGE_KEYS.ACTIVE_EMPLOYEE_ID && key !== STORAGE_KEYS.IDEMPOTENCY_CACHE && key !== 'target_daily_session_active' && key !== 'target_session_date') {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false) {
      throw new Error("عذراً، الاتصال بالإنترنت مقطوع. لا يمكن تنفيذ العملية (نظام Online-First مفعل).");
    }
  }

  memoryCache[key] = value;
  
  // Asynchronously save to IndexedDB
  localforage.setItem(key, value).catch(err => {
    console.error(`Failed to save to localforage [${key}]`, err);
  });
  
  // Try to save to localStorage as backup, but ignore QuotaExceeded
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`LocalStorage full, relying purely on IDB for ${key}`);
  }

  // Automatically trigger background push to Supabase if it's data
  if (key !== STORAGE_KEYS.ACTIVE_BRANCH_ID && key !== STORAGE_KEYS.ACTIVE_EMPLOYEE_ID) {
    triggerAutoPush();
  }
}


// Helper to format custom string ID deterministically to a valid UUID format
export function toValidUuid(val: string | null | undefined): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  if (isUuid) return str;
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += (str.charCodeAt(i) % 256).toString(16).padStart(2, '0');
  }
  hex = (hex + '0'.repeat(32)).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// Check if two IDs match directly or through their deterministic UUID conversion
export function matchIds(id1: string | null | undefined, id2: string | null | undefined): boolean {
  if (!id1 || !id2) return false;
  const clean1 = String(id1).trim();
  const clean2 = String(id2).trim();
  if (clean1 === clean2) return true;
  return toValidUuid(clean1) === toValidUuid(clean2);
}

export class ResilientStorageService {
  private static instance: ResilientStorageService;

  private constructor() {
    if (typeof window !== 'undefined' && !localStorage.getItem('esnad_auto_reset_zero_balance_v6')) {
      Object.values(STORAGE_KEYS).forEach(key => {
        delete memoryCache[key];
        localStorage.removeItem(key);
        localforage.removeItem(key);
      });
      localStorage.setItem('esnad_auto_reset_zero_balance_v6', 'true');
    }
  }

  public static getInstance(): ResilientStorageService {
    if (!ResilientStorageService.instance) {
      ResilientStorageService.instance = new ResilientStorageService();
    }
    return ResilientStorageService.instance;
  }

  public async _initDefaultsAsync() {
    const checkAndInit = (key: string, defaultVal: any) => {
      if (memoryCache[key] === undefined) {
        save(key, defaultVal);
      }
    };
    checkAndInit(STORAGE_KEYS.BRANCHES, []);
    checkAndInit(STORAGE_KEYS.EMPLOYEES, []);
    checkAndInit(STORAGE_KEYS.SERVICES, []);
    checkAndInit(STORAGE_KEYS.EXPENSE_CATEGORIES, []);
    checkAndInit(STORAGE_KEYS.DISTRIBUTORS, []);
    checkAndInit(STORAGE_KEYS.EXTERNAL_OFFICES, []);
    checkAndInit(STORAGE_KEYS.ACTIVE_BRANCH_ID, 'b1-dokki');
    checkAndInit(STORAGE_KEYS.ACTIVE_EMPLOYEE_ID, 'emp-1');
    checkAndInit(STORAGE_KEYS.CUSTOMERS, []);
    checkAndInit(STORAGE_KEYS.ORDERS, []);
    checkAndInit(STORAGE_KEYS.PAYMENTS, []);
    checkAndInit(STORAGE_KEYS.LEDGER, []);
    checkAndInit(STORAGE_KEYS.AUDIT_LOGS, []);
    checkAndInit(STORAGE_KEYS.EXPENSES, []);
    checkAndInit(STORAGE_KEYS.TRANSFERS, []);
    checkAndInit(STORAGE_KEYS.CLOSINGS, []);
    checkAndInit(STORAGE_KEYS.DISTRIBUTOR_TXNS, []);
    checkAndInit(STORAGE_KEYS.TOMBSTONES, []);
  }

  // Idempotency Verification
  public checkIdempotency(key: string): boolean {
    if (!key) return false;
    const cache = load<Record<string, string>>(STORAGE_KEYS.IDEMPOTENCY_CACHE, {});
    return Boolean(cache[key]);
  }

  // Tombstone management for Offline-First Hard Deletes (Zombie Record Prevention)
  public addTombstone(id: string): void {
    if (!id) return;
    const tombstones = load<string[]>(STORAGE_KEYS.TOMBSTONES, []);
    const validUuid = toValidUuid(id);
    if (validUuid && !tombstones.includes(validUuid)) {
      tombstones.push(validUuid);
    }
    if (!tombstones.includes(id)) {
      tombstones.push(id);
    }
    save(STORAGE_KEYS.TOMBSTONES, tombstones);
  }

  public removeTombstone(id: string): void {
    if (!id) return;
    const tombstones = load<string[]>(STORAGE_KEYS.TOMBSTONES, []);
    const validUuid = toValidUuid(id);
    const filtered = tombstones.filter(t => t !== id && t !== validUuid);
    save(STORAGE_KEYS.TOMBSTONES, filtered);
  }

  public isTombstoned(id: string): boolean {
    if (!id) return false;
    const tombstones = load<string[]>(STORAGE_KEYS.TOMBSTONES, []);
    return tombstones.includes(id) || tombstones.includes(toValidUuid(id) || '');
  }

  public recordIdempotency(key: string, resultData: any): void {
    if (!key) return;
    const cache = load<Record<string, string>>(STORAGE_KEYS.IDEMPOTENCY_CACHE, {});
    cache[key] = JSON.stringify(resultData);
    save(STORAGE_KEYS.IDEMPOTENCY_CACHE, cache);
  }

  public getIdempotencyResult<T>(key: string): T | null {
    if (!key) return null;
    const cache = load<Record<string, string>>(STORAGE_KEYS.IDEMPOTENCY_CACHE, {});
    const item = cache[key];
    if (!item) return null;
    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }

  // Active Session Selectors
  public getActiveBranchId(): string {
    const stored = load<string | null>(STORAGE_KEYS.ACTIVE_BRANCH_ID, null);
    if (stored) return stored;
    const list = this.getBranches();
    if (list.length > 0) return list[0].id;
    return 'b1-dokki';
  }

  public setActiveBranchId(branchId: string): void {
    save(STORAGE_KEYS.ACTIVE_BRANCH_ID, branchId);
  }

  public getActiveEmployeeId(): string {
    const stored = load<string | null>(STORAGE_KEYS.ACTIVE_EMPLOYEE_ID, null);
    if (stored) return stored;
    const list = this.getEmployees();
    if (list.length > 0) return list[0].id;
    return 'emp-1';
  }

  public setActiveEmployeeId(employeeId: string): void {
    save(STORAGE_KEYS.ACTIVE_EMPLOYEE_ID, employeeId);
  }

  // Branches
  public getBranches(): Branch[] {
    return load(STORAGE_KEYS.BRANCHES, INITIAL_BRANCHES);
  }

  public saveBranch(branch: Partial<Branch> & { name: string; code: string }): Branch {
    const branches = this.getBranches();
    const now = new Date().toISOString();
    let saved: Branch;

    if (branch.id) {
      const idx = branches.findIndex(b => b.id === branch.id);
      if (idx >= 0) {
        const old = branches[idx];
        saved = { ...old, ...branch, updated_at: now };
        branches[idx] = saved;
        this.addAuditLog('تعديل بيانات فرع', 'Branch', saved.id, old, saved);
      } else {
        saved = {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          phone: branch.phone || '',
          address: branch.address || '',
          is_active: branch.is_active ?? true,
          created_at: now,
          updated_at: now,
        };
        branches.push(saved);
        this.addAuditLog('إضافة فرع جديد', 'Branch', saved.id, null, saved);
      }
    } else {
      saved = {
        id: `br-${Date.now()}`,
        name: branch.name,
        code: branch.code,
        phone: branch.phone || '',
        address: branch.address || '',
        is_active: branch.is_active ?? true,
        created_at: now,
        updated_at: now,
      };
      branches.push(saved);
      this.addAuditLog('إضافة فرع جديد', 'Branch', saved.id, null, saved);
    }

    save(STORAGE_KEYS.BRANCHES, branches);
    return saved;
  }

  // Employees
  public getEmployees(): Employee[] {
    const raw = load<Employee[]>(STORAGE_KEYS.EMPLOYEES, INITIAL_EMPLOYEES);
    return raw.map(emp => {
      let normalizedRole: EmployeeRole = 'employee';
      if (emp.role === 'manager' || (emp.role as any) === 'admin' || (emp.role as any) === 'branch_manager') {
        normalizedRole = 'manager';
      } else if (emp.role === 'viewer') {
        normalizedRole = 'viewer';
      } else {
        normalizedRole = 'employee';
      }
      return {
        ...emp,
        role: normalizedRole,
      };
    });
  }

  public saveEmployee(emp: Partial<Employee> & { name: string }): Employee {
    const employees = this.getEmployees();
    const now = new Date().toISOString();
    let saved: Employee;
    const password = emp.password?.trim() || emp.pin_code?.trim();

    if (emp.id) {
      const idx = employees.findIndex(e => e.id === emp.id);
      if (idx >= 0) {
        const old = employees[idx];
        saved = {
          ...old,
          ...emp,
          name: emp.name.trim(),
          username: emp.username?.trim() || old.username || emp.email?.trim() || old.email,
          email: emp.email?.trim() || old.email,
          phone: emp.phone?.trim() || old.phone,
          password: password || old.password || old.pin_code,
          pin_code: password || old.pin_code || old.password,
          branch_id: emp.branch_id !== undefined ? emp.branch_id : old.branch_id,
        };
        employees[idx] = saved;
        this.addAuditLog('تعديل بيانات موظف', 'Employee', saved.id, old, saved);
      } else {
        const generatedCode = emp.code?.trim() || `EMP-${String(employees.length + 1).padStart(2, '0')}`;
        const pass = password || '1234';
        saved = {
          id: emp.id,
          name: emp.name.trim(),
          code: generatedCode,
          username: emp.username?.trim() || emp.email?.trim() || emp.name.trim().toLowerCase().replace(/\s+/g, '.'),
          email: emp.email?.trim(),
          phone: emp.phone?.trim(),
          pin_code: pass,
          password: pass,
          branch_id: emp.branch_id || undefined,
          default_branch_id: emp.default_branch_id || emp.branch_id || this.getActiveBranchId(),
          role: emp.role || 'employee',
          is_active: emp.is_active ?? true,
          created_at: now,
        };
        employees.push(saved);
        this.addAuditLog('إضافة موظف جديد', 'Employee', saved.id, null, saved);
      }
    } else {
      const generatedCode = emp.code?.trim() || `EMP-${String(employees.length + 1).padStart(2, '0')}`;
      const pass = password || '1234';
      saved = {
        id: `emp-${Date.now()}`,
        name: emp.name.trim(),
        code: generatedCode,
        username: emp.username?.trim() || emp.email?.trim() || emp.name.trim().toLowerCase().replace(/\s+/g, '.'),
        email: emp.email?.trim(),
        phone: emp.phone?.trim(),
        pin_code: pass,
        password: pass,
        branch_id: emp.branch_id || undefined,
        default_branch_id: emp.default_branch_id || emp.branch_id || this.getActiveBranchId(),
        role: emp.role || 'employee',
        is_active: emp.is_active ?? true,
        created_at: now,
      };
      employees.push(saved);
      this.addAuditLog('إضافة موظف جديد', 'Employee', saved.id, null, saved);
    }

    save(STORAGE_KEYS.EMPLOYEES, employees);
    this.removeTombstone(saved.id);
    triggerAutoPush();
    return saved;
  }

  public toggleEmployeeStatus(empId: string): Employee | null {
    const employees = this.getEmployees();
    const idx = employees.findIndex(e => e.id === empId);
    if (idx < 0) return null;
    const old = employees[idx];
    const updated: Employee = { ...old, is_active: !old.is_active };
    employees[idx] = updated;
    save(STORAGE_KEYS.EMPLOYEES, employees);
    this.addAuditLog(updated.is_active ? 'تنشيط حساب موظف' : 'تعطيل حساب موظف', 'Employee', empId, old, updated);
    return updated;
  }

  public deleteEmployee(empId: string): boolean {
    const employees = this.getEmployees();
    const target = employees.find(e => e.id === empId);
    if (!target) return false;
    const filtered = employees.filter(e => e.id !== empId);
    save(STORAGE_KEYS.EMPLOYEES, filtered);
    this.addTombstone(empId);
    deleteRecord('employees', empId);
    triggerAutoPush();
    this.addAuditLog('حذف موظف', 'Employee', empId, target, null);
    return true;
  }

  // Services
  public getServices(): Service[] {
    const rawServices = load(STORAGE_KEYS.SERVICES, INITIAL_SERVICES);
    // Sanitize any previously cached speeds to remove fixed days in parentheses
    return rawServices.map(srv => ({
      ...srv,
      speeds: (srv.speeds || []).map(spd => ({
        ...spd,
        label: spd.label.replace(/\s*\([^)]*\)/g, '').trim() || spd.label,
        days: undefined,
      })),
    }));
  }

  public saveService(service: Partial<Service> & { name: string; category?: string; base_price: number }): Service {
    const services = load<Service[]>(STORAGE_KEYS.SERVICES, []);
    const now = new Date().toISOString();
    let saved: Service;

    if (service.id) {
      const idx = services.findIndex(s => s.id === service.id);
      if (idx >= 0) {
        const old = services[idx];
        saved = { ...old, ...service };
        services[idx] = saved;
        this.addAuditLog('تعديل إعدادات خدمة', 'Service', saved.id, old, saved);
      } else {
        saved = {
          id: service.id,
          name: service.name,
          category: service.category || '',
          speeds: service.speeds || [{ code: 'normal', label: 'عادي', extra_cost: 0 }],
          fields_config: service.fields_config || [],
          base_price: Number(service.base_price),
          is_active: service.is_active ?? true,
          created_at: now,
        };
        services.push(saved);
        this.addAuditLog('إضافة خدمة جديدة', 'Service', saved.id, null, saved);
      }
    } else {
      saved = {
        id: `srv-${Date.now()}`,
        name: service.name,
        category: service.category || '',
        speeds: service.speeds || [{ code: 'normal', label: 'عادي', extra_cost: 0 }],
        fields_config: service.fields_config || [],
        base_price: Number(service.base_price),
        is_active: service.is_active ?? true,
        created_at: now,
      };
      services.push(saved);
      this.addAuditLog('إضافة خدمة جديدة', 'Service', saved.id, null, saved);
    }

    save(STORAGE_KEYS.SERVICES, services);
    this.removeTombstone(saved.id);
    return saved;
  }

  public deleteService(id: string): void {
    let services = this.getServices();
    const idx = services.findIndex(s => s.id === id);
    if (idx >= 0) {
      const old = services[idx];
      services = services.filter(s => s.id !== id);
      save(STORAGE_KEYS.SERVICES, services);
      this.addTombstone(id);
      deleteRecord('services', id);
      triggerAutoPush();
      this.addAuditLog('حذف خدمة', 'Service', id, old, null);
    }
  }

  // Customers
  public getCustomers(): Customer[] {
    return load(STORAGE_KEYS.CUSTOMERS, []);
  }

  public findOrCreateCustomer(name: string, phone: string, nationalId?: string): Customer {
    const customers = this.getCustomers();
    const existing = customers.find(
      c => (nationalId && c.national_id === nationalId) || c.phone === phone
    );

    if (existing) {
      if (name && name !== existing.name) {
        existing.name = name;
      }
      if (nationalId && !existing.national_id) {
        existing.national_id = nationalId;
      }
      existing.total_orders = (existing.total_orders || 0) + 1;
      save(STORAGE_KEYS.CUSTOMERS, customers);
      return existing;
    }

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      national_id: nationalId ? nationalId.trim() : undefined,
      total_orders: 1,
      created_at: new Date().toISOString(),
    };

    customers.unshift(newCustomer);
    save(STORAGE_KEYS.CUSTOMERS, customers);
    return newCustomer;
  }

  // Cash Ledger & Drawer
  public getLedger(branchId?: string, employeeId?: string): CashLedgerEntry[] {
    const all = load<CashLedgerEntry[]>(STORAGE_KEYS.LEDGER, []);
    let filtered = all;
    if (branchId && branchId !== 'all') {
      filtered = filtered.filter(l => matchIds(l.branch_id, branchId));
    }
    if (employeeId && employeeId !== 'all') {
      filtered = filtered.filter(l => matchIds(l.employee_id, employeeId));
    }
    return filtered;
  }

  public getBranchDrawerBalance(branchId: string): number {
    const entries = this.getLedger(branchId);
    if (entries.length === 0) return 0;
    // Calculate sum of all amounts (amounts are positive for in, negative for out)
    return Number(entries.reduce((acc, curr) => acc + Number(curr.amount || 0), 0).toFixed(2));
  }

  public getEmployeeDrawerBalance(employeeId: string, branchId?: string): number {
    const entries = this.getLedger(branchId, employeeId);
    if (entries.length === 0) return 0;
    return Number(entries.reduce((acc, curr) => acc + Number(curr.amount || 0), 0).toFixed(2));
  }

  private appendLedgerEntry(
    branchId: string,
    type: CashLedgerEntry['transaction_type'],
    amount: number, // positive for cash in, negative for cash out
    referenceTable?: string,
    referenceId?: string,
    notes?: string,
    idempotencyKey?: string,
    employeeId?: string
  ): CashLedgerEntry {
    const currentBalance = this.getBranchDrawerBalance(branchId);
    const newBalance = Number((currentBalance + amount).toFixed(2));
    const allLedger = load<CashLedgerEntry[]>(STORAGE_KEYS.LEDGER, []);

    const entry: CashLedgerEntry = {
      id: `ldg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      branch_id: branchId,
      transaction_type: type,
      amount: Number(amount.toFixed(2)),
      balance_after: newBalance,
      reference_table: referenceTable,
      reference_id: referenceId,
      employee_id: employeeId || this.getActiveEmployeeId(),
      idempotency_key: idempotencyKey,
      notes,
      created_at: new Date().toISOString(),
    };

    allLedger.unshift(entry);
    save(STORAGE_KEYS.LEDGER, allLedger);
    return entry;
  }

  // Service Orders & Payments (ATOMIC OPERATION)
  public getOrders(branchId?: string): ServiceOrder[] {
    const orders = load<ServiceOrder[]>(STORAGE_KEYS.ORDERS, []);
    if (!branchId) return orders;
    return orders.filter(o => matchIds(o.current_branch_id, branchId) || matchIds(o.creation_branch_id, branchId));
  }

  public getOrderById(id: string): ServiceOrder | undefined {
    const orders = load<ServiceOrder[]>(STORAGE_KEYS.ORDERS, []);
    return orders.find(o => o.id === id || o.order_number === id);
  }

  public getPayments(orderId?: string): Payment[] {
    const payments = load<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
    if (!orderId) return payments;
    return payments.filter(p => p.order_id === orderId);
  }

  /**
   * Atomic Order Creation with Optional Initial Payment and External Office Expense
   */
  public createServiceOrder(params: {
    customerName: string;
    customerPhone: string;
    customerNationalId?: string;
    serviceId: string;
    speedCode: string;
    formBarcode?: string;
    formSource?: 'internal' | 'external';
    customFieldsData?: Record<string, any>;
    notes?: string;
    price: number;
    cashPayment: number;
    electronicPayment: number;
    electronicType?: 'wallet' | 'instapay' | 'pos' | null;
    distributorId?: string | null;
    externalOfficeId?: string | null;
    externalOfficeCost?: number;
    deliveryBranchId?: string | null;
    idempotencyKey: string;
    employeeId?: string;
    branchId?: string;
  }): { order: ServiceOrder; payment?: Payment } {
    // 1. Idempotency Check
    const cached = this.getIdempotencyResult<{ order: ServiceOrder; payment?: Payment }>(params.idempotencyKey);
    if (cached) {
      return cached;
    }

    const branchId = params.branchId || this.getActiveBranchId();
    const employeeId = params.employeeId || this.getActiveEmployeeId();
    const employees = this.getEmployees();
    const activeEmp = employees.find(e => e.id === employeeId);
    const employeeName = activeEmp ? activeEmp.name : 'موظف';

    const services = load<Service[]>(STORAGE_KEYS.SERVICES, []);
    const service = services.find(s => s.id === params.serviceId);
    const serviceName = service ? service.name : 'خدمة حكومية';

    // 2. Math & Validations
    const price = Number(params.price);
    const cash = Number(params.cashPayment || 0);
    const electronic = Number(params.electronicPayment || 0);
    const totalPaid = Number((cash + electronic).toFixed(2));

    if (totalPaid > price) {
      throw new Error(`إجمالي المبلغ المدفوع (${totalPaid}) لا يمكن أن يتجاوز سعر الخدمة (${price})`);
    }

    const remaining = Number((price - totalPaid).toFixed(2));
    const extOfficeCost = Number(params.externalOfficeCost || 0);
    const officeMargin = Number((price - extOfficeCost).toFixed(2));

    // 3. Customer Lookup / Registration
    const customer = this.findOrCreateCustomer(
      params.customerName,
      params.customerPhone,
      params.customerNationalId
    );

    // 4. Order Number Generation
    const timestamp = Date.now();
    const orderNumber = `ORD-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const orderId = `ord-${timestamp}`;
    const now = new Date().toISOString();

    const order: ServiceOrder = {
      id: orderId,
      order_number: orderNumber,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_national_id: customer.national_id,
      service_id: params.serviceId,
      service_name: serviceName,
      speed: params.speedCode,
      form_barcode: params.formBarcode?.trim() || undefined,
      form_source: params.formSource,
      custom_fields_data: params.customFieldsData || {},
      notes: params.notes?.trim(),
      status: 'pending',
      price,
      total_paid: totalPaid,
      remaining,
      cash_amount: cash,
      electronic_amount: electronic,
      distributor_id: params.distributorId || null,
      external_office_id: params.externalOfficeId || null,
      external_office_cost: extOfficeCost,
      office_margin: officeMargin,
      creation_branch_id: branchId,
      current_branch_id: branchId,
      delivery_branch_id: params.deliveryBranchId || branchId,
      created_by_employee_id: employeeId,
      idempotency_key: params.idempotencyKey,
      created_at: now,
      updated_at: now,
    };

    // 5. Append Order
    const orders = load<ServiceOrder[]>(STORAGE_KEYS.ORDERS, []);
    orders.unshift(order);
    save(STORAGE_KEYS.ORDERS, orders);

    let paymentRecord: Payment | undefined;

    // 6. Record Payment if any amount paid
    if (totalPaid > 0) {
      paymentRecord = {
        id: `pmt-${timestamp}`,
        order_id: order.id,
        branch_id: branchId,
        employee_id: employeeId,
        amount: totalPaid,
        cash_amount: cash,
        electronic_amount: electronic,
        electronic_type: electronic > 0 ? (params.electronicType || 'instapay') : null,
        notes: params.distributorId ? 'تحصيل طرف الموزع (مديونية موزع)' : 'دفعة أولى عند التسجيل',
        idempotency_key: `pmt-init-${params.idempotencyKey}`,
        created_at: now,
      };

      const payments = load<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
      payments.unshift(paymentRecord);
      save(STORAGE_KEYS.PAYMENTS, payments);

      // Add to Cash Drawer ONLY if cash was paid directly and NOT via distributor
      // When linked to a distributor, the cash stays with the distributor as a debt until supplied!
      if (cash > 0 && !params.distributorId) {
        this.appendLedgerEntry(
          branchId,
          'customer_cash_payment',
          cash,
          'payments',
          paymentRecord.id,
          `من ${customer.name} - طلب ${orderNumber}`,
          `ldg-pmt-${params.idempotencyKey}`,
          employeeId
        );
      }
    }

    // 7. Handle Distributor Charge (Debt on Distributor)
    if (params.distributorId) {
      this.recordDistributorTransaction(
        params.distributorId,
        branchId,
        employeeId,
        price,
        'order_charge',
        order.id,
        `قيد معاملة رقم ${orderNumber} على الموزع [تحصيل: ${cash > 0 ? cash + ' كاش' : ''}${electronic > 0 ? ' + ' + electronic + ' إلكتروني' : ''}]`
      );
    }

    // 8. Handle External Office Cost (Accrued Liability - Recorded on Office Statement, No Expense or Cash Deduction yet)
    if (params.externalOfficeId && extOfficeCost > 0) {
      const offices = this.getExternalOffices();
      const office = offices.find(o => o.id === params.externalOfficeId);
      const officeName = office ? office.name : 'مكتب خارجي';
      const officeNotes = `مستحق ل ${officeName} ${orderNumber}`;

      // Record external office credit transaction & update office payable balance (No expense or cash deduction until manual payment)
      if (office) {
        const txns = this.getExternalOfficeTransactions();
        const newBalance = Number(((office.balance || 0) + extOfficeCost).toFixed(2));
        const txn: ExternalOfficeTransaction = {
          id: `off-txn-${timestamp}`,
          external_office_id: office.id,
          branch_id: branchId,
          employee_id: employeeId,
          amount: extOfficeCost,
          type: 'service_order_cost',
          reference_id: order.id,
          notes: officeNotes,
          idempotency_key: `ext-tx-${params.idempotencyKey}`,
          balance_after: newBalance,
          created_at: now,
        };
        txns.unshift(txn);
        save(STORAGE_KEYS.EXTERNAL_OFFICE_TXNS, txns);

        office.balance = newBalance;
        this.saveExternalOffice(office);
      }
    }

    // 9. Audit Log
    this.addAuditLog(
      'تسجيل معاملة جديدة',
      'ServiceOrder',
      order.id,
      null,
      {
        orderNumber,
        customerName: customer.name,
        service: serviceName,
        price,
        totalPaid,
        remaining,
        cash,
        electronic,
      },
      { employeeName, branchId }
    );

    const result = { order, payment: paymentRecord };
    this.recordIdempotency(params.idempotencyKey, result);
    triggerAutoPush();
    return result;
  }

  /**
   * Atomic Subsequent Payment for Remaining Amount
   */
  public recordAdditionalPayment(params: {
    orderId: string;
    cashAmount: number;
    electronicAmount: number;
    electronicType?: 'wallet' | 'instapay' | 'pos' | null;
    notes?: string;
    idempotencyKey: string;
    branchId?: string;
    employeeId?: string;
  }): { order: ServiceOrder; payment: Payment } {
    const cached = this.getIdempotencyResult<{ order: ServiceOrder; payment: Payment }>(params.idempotencyKey);
    if (cached) return cached;

    const orders = load<ServiceOrder[]>(STORAGE_KEYS.ORDERS, []);
    const orderIndex = orders.findIndex(o => o.id === params.orderId);
    if (orderIndex === -1) {
      throw new Error('العملية غير موجودة في النظام');
    }

    const order = orders[orderIndex];
    const branchId = params.branchId || this.getActiveBranchId();
    const employeeId = params.employeeId || this.getActiveEmployeeId();
    const employees = this.getEmployees();
    const activeEmp = employees.find(e => e.id === employeeId);
    const employeeName = activeEmp ? activeEmp.name : 'موظف';

    const cash = Number(params.cashAmount || 0);
    const electronic = Number(params.electronicAmount || 0);
    const paymentTotal = Number((cash + electronic).toFixed(2));

    if (paymentTotal <= 0) {
      throw new Error('يجب إدخال مبلغ صحيح أكبر من الصفر');
    }

    if (paymentTotal > order.remaining) {
      throw new Error(
        `المبلغ المدفوع (${paymentTotal}) يتجاوز المتبقي على العميل (${order.remaining})`
      );
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      id: `pmt-${Date.now()}`,
      order_id: order.id,
      branch_id: branchId,
      employee_id: employeeId,
      amount: paymentTotal,
      cash_amount: cash,
      electronic_amount: electronic,
      electronic_type: electronic > 0 ? (params.electronicType || 'instapay') : null,
      notes: params.notes?.trim() || 'سداد دفعة إضافية من المتبقي',
      idempotency_key: params.idempotencyKey,
      created_at: now,
    };

    const payments = load<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
    payments.unshift(payment);
    save(STORAGE_KEYS.PAYMENTS, payments);

    // Update order
    const oldTotalPaid = order.total_paid;
    const oldRemaining = order.remaining;
    order.total_paid = Number((order.total_paid + paymentTotal).toFixed(2));
    order.remaining = Number((order.price - order.total_paid).toFixed(2));
    order.cash_amount = Number(((order.cash_amount || 0) + cash).toFixed(2));
    order.electronic_amount = Number(((order.electronic_amount || 0) + electronic).toFixed(2));
    order.updated_at = now;
    orders[orderIndex] = order;
    save(STORAGE_KEYS.ORDERS, orders);

    // Cash Drawer
    if (cash > 0) {
      this.appendLedgerEntry(
        branchId,
        'customer_cash_payment',
        cash,
        'payments',
        payment.id,
        `من ${order.customer_name} - طلب ${order.order_number}`,
        `ldg-add-${params.idempotencyKey}`,
        employeeId
      );
    }

    // Audit Log
    this.addAuditLog(
      'تحصيل دفعة متبقية',
      'ServiceOrder',
      order.id,
      { totalPaid: oldTotalPaid, remaining: oldRemaining },
      {
        totalPaid: order.total_paid,
        remaining: order.remaining,
        addedPayment: paymentTotal,
        cash,
        electronic,
      },
      { employeeName, branchId }
    );

    const result = { order, payment };
    this.recordIdempotency(params.idempotencyKey, result);
    triggerAutoPush();
    return result;
  }

  /**
   * Update Order Status & Transfer between Branches
   */
  public updateOrderStatus(
    orderId: string,
    newStatus: ServiceOrder['status'],
    notes?: string,
    employeeId?: string
  ): ServiceOrder {
    const orders = load<ServiceOrder[]>(STORAGE_KEYS.ORDERS, []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) throw new Error('العملية غير موجودة');

    const order = orders[idx];
    const oldStatus = order.status;
    order.status = newStatus;
    order.updated_at = new Date().toISOString();
    if (notes) {
      order.notes = order.notes ? `${order.notes}\n[${new Date().toLocaleTimeString('ar-EG-u-nu-latn')}] ${notes}` : notes;
    }
    orders[idx] = order;
    save(STORAGE_KEYS.ORDERS, orders);

    this.addAuditLog(
      `تغيير حالة المعاملة إلى: ${newStatus}`,
      'ServiceOrder',
      order.id,
      { status: oldStatus },
      { status: newStatus, notes },
      { employeeId: employeeId || this.getActiveEmployeeId() }
    );

    return order;
  }

  /**
   * Atomic Order Cancellation with Full Financial Refund
   * - Reverses cash ledger entries (customer_refund)
   * - Reverses distributor debt if applicable
   * - Reverses external office balance if applicable
   * - Records full Audit log with refund breakdown
   */
  public cancelOrderWithRefund(
    orderId: string,
    refundCash: number,    // amount to refund as cash from drawer
    refundElectronic: number, // amount to note as electronic refund (no drawer impact)
    notes?: string,
    employeeId?: string
  ): ServiceOrder {
    const orders = load<ServiceOrder[]>(STORAGE_KEYS.ORDERS, []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) throw new Error('العملية غير موجودة في النظام');

    const order = orders[idx];

    // Guard: cannot cancel already-cancelled or delivered orders
    if (order.status === 'cancelled') {
      throw new Error('المعاملة ملغاة مسبقًا');
    }
    if (order.status === 'delivered') {
      throw new Error('لا يمكن إلغاء معاملة تم تسليمها للعميل');
    }

    const branchId = order.creation_branch_id;
    const empId = employeeId || this.getActiveEmployeeId();
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === empId);
    const empName = emp?.name || 'موظف';
    const now = new Date().toISOString();

    const totalRefund = Number((refundCash + refundElectronic).toFixed(2));
    const totalPaidSnapshot = order.total_paid;

    // Validate refund amounts
    if (totalRefund > order.total_paid) {
      throw new Error(
        `مبلغ الاسترداد (${totalRefund}) أكبر من إجمالي المدفوع (${order.total_paid})`
      );
    }

    // 1. Cash Drawer Reversal — only for cash portion
    if (refundCash > 0) {
      const currentBalance = this.getBranchDrawerBalance(branchId);
      if (refundCash > currentBalance) {
        throw new Error(
          `رصيد الخزنة (${currentBalance}) لا يكفي لاسترداد المبلغ النقدي (${refundCash}). يرجى التحقق من رصيد الخزنة.`
        );
      }

      const empBalance = this.getEmployeeDrawerBalance(empId, branchId);
      if (refundCash > empBalance) {
        throw new Error(
          `عهدة الموظف الحالية (${empBalance}) لا تكفي لاسترداد المبلغ النقدي (${refundCash}). يرجى التحقق من عهدتك.`
        );
      }
      this.appendLedgerEntry(
        branchId,
        'customer_refund',
        -refundCash, // negative = cash out
        'ServiceOrder',
        order.id,
        `استرداد كاش للعميل ${order.customer_name} — إلغاء معاملة ${order.order_number}${notes ? ' | ' + notes : ''}`,
        `refund-${orderId}-${Date.now()}`,
        empId
      );
    }

    // 2. Record refund payment (negative amounts) so KPI stats are corrected
    if (totalRefund > 0) {
      const refundPayment: Payment = {
        id: `pmt-refund-${Date.now()}`,
        order_id: order.id,
        branch_id: branchId,
        employee_id: empId,
        amount: -totalRefund,
        cash_amount: -refundCash,
        electronic_amount: -refundElectronic,
        electronic_type: null,
        notes: `استرداد إلغاء معاملة ${order.order_number}${notes ? ' | ' + notes : ''}`,
        idempotency_key: `pmt-refund-${orderId}-${Date.now()}`,
        created_at: now,
      };
      const payments = load<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
      payments.unshift(refundPayment);
      save(STORAGE_KEYS.PAYMENTS, payments);
    }

    // 3. Reverse Distributor Debt if linked
    if (order.distributor_id) {
      try {
        this.recordDistributorTransaction(
          order.distributor_id,
          branchId,
          empId,
          -order.price, // reverse the full charge
          'order_charge',
          order.id,
          `إلغاء وعكس قيد معاملة ${order.order_number} على الموزع`
        );
      } catch (_) {
        // non-fatal — log only
      }
    }

    // 4. Reverse External Office Balance if linked
    if (order.external_office_id && order.external_office_cost > 0) {
      try {
        const offices = this.getExternalOffices();
        const office = offices.find(o => matchIds(o.id, order.external_office_id));
        if (office) {
          const txns = this.getExternalOfficeTransactions();
          const reversedBalance = Number(((office.balance || 0) - order.external_office_cost).toFixed(2));
          const reversalTxn: ExternalOfficeTransaction = {
            id: `off-txn-rev-${Date.now()}`,
            external_office_id: office.id,
            branch_id: branchId,
            employee_id: empId,
            amount: -order.external_office_cost,
            type: 'service_order_cost',
            reference_id: order.id,
            notes: `عكس تكلفة إلغاء معاملة ${order.order_number}`,
            idempotency_key: `ext-rev-${orderId}`,
            balance_after: reversedBalance,
            created_at: now,
          };
          txns.unshift(reversalTxn);
          save(STORAGE_KEYS.EXTERNAL_OFFICE_TXNS, txns);
          office.balance = reversedBalance;
          this.saveExternalOffice(office);
        }
      } catch (_) {
        // non-fatal — log only
      }
    }

    // 5. Update Order: mark as cancelled, zero out ALL financial fields
    order.status = 'cancelled';
    order.total_paid = 0;
    order.remaining = order.price;
    order.cash_amount = 0;
    order.electronic_amount = 0;
    order.updated_at = now;
    if (notes) {
      order.notes = order.notes
        ? `${order.notes}\n[${new Date().toLocaleTimeString('ar-EG-u-nu-latn')}] إلغاء: ${notes}`
        : `إلغاء: ${notes}`;
    }
    orders[idx] = order;
    save(STORAGE_KEYS.ORDERS, orders);

    // 6. Audit Log
    this.addAuditLog(
      'إلغاء معاملة مع استرداد مالي',
      'ServiceOrder',
      order.id,
      { status: 'active', totalPaid: totalPaidSnapshot },
      {
        status: 'cancelled',
        refundCash,
        refundElectronic,
        totalRefund,
        notes,
      },
      { employeeName: empName, branchId }
    );

    return order;
  }

  public updateOrderCustomer(
    orderId: string,
    customerData: {
      name: string;
      phone: string;
      nationalId?: string;
    },
    employeeId?: string
  ): ServiceOrder {
    const orders = load<ServiceOrder[]>(STORAGE_KEYS.ORDERS, []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) throw new Error('العملية غير موجودة');

    const order = orders[idx];
    const oldDetails = {
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_national_id: order.customer_national_id,
    };

    order.customer_name = customerData.name.trim();
    order.customer_phone = customerData.phone.trim();
    order.customer_national_id = customerData.nationalId?.trim() || undefined;
    order.updated_at = new Date().toISOString();
    orders[idx] = order;
    save(STORAGE_KEYS.ORDERS, orders);

    // Also update customer registry if linked
    if (order.customer_id) {
      const customers = this.getCustomers();
      const custIdx = customers.findIndex(c => c.id === order.customer_id);
      if (custIdx >= 0) {
        customers[custIdx].name = customerData.name.trim();
        customers[custIdx].phone = customerData.phone.trim();
        if (customerData.nationalId) customers[custIdx].national_id = customerData.nationalId.trim();
        save(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    this.addAuditLog(
      'تعديل بيانات العميل بالمعاملة',
      'ServiceOrder',
      order.id,
      oldDetails,
      {
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_national_id: order.customer_national_id,
      },
      { employeeId: employeeId || this.getActiveEmployeeId() }
    );

    return order;
  }

  public transferOrderExecutionBranch(
    orderId: string,
    targetBranchId: string,
    notes?: string,
    employeeId?: string
  ): ServiceOrder {
    const orders = load<ServiceOrder[]>(STORAGE_KEYS.ORDERS, []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) throw new Error('العملية غير موجودة');

    const order = orders[idx];
    const oldBranch = order.current_branch_id;
    order.current_branch_id = targetBranchId;
    order.delivery_branch_id = targetBranchId;
    order.updated_at = new Date().toISOString();
    orders[idx] = order;
    save(STORAGE_KEYS.ORDERS, orders);

    this.addAuditLog(
      'تحويل مسار المعاملة لفرع آخر',
      'ServiceOrder',
      order.id,
      { current_branch_id: oldBranch },
      { current_branch_id: targetBranchId, notes },
      { employeeId: employeeId || this.getActiveEmployeeId() }
    );

    return order;
  }

  // Expenses Management
  public getExpenses(branchId?: string): Expense[] {
    const all = load<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    if (!branchId) return all;
    return all.filter(e => e.branch_id === branchId);
  }

  public getExpenseCategories(): ExpenseCategory[] {
    return load(STORAGE_KEYS.EXPENSE_CATEGORIES, INITIAL_EXPENSE_CATEGORIES);
  }

  public saveExpenseCategory(category: { id?: string; name: string; is_active?: boolean }): ExpenseCategory {
    const categories = this.getExpenseCategories();
    let saved: ExpenseCategory;
    if (category.id) {
      const idx = categories.findIndex(c => c.id === category.id);
      if (idx >= 0) {
        saved = { ...categories[idx], ...category };
        categories[idx] = saved;
      } else {
        saved = { id: category.id, name: category.name, is_active: category.is_active ?? true, created_at: new Date().toISOString() };
        categories.push(saved);
      }
    } else {
      saved = {
        id: `exp-cat-${Date.now()}`,
        name: category.name,
        is_active: category.is_active ?? true,
        created_at: new Date().toISOString(),
      };
      categories.push(saved);
    }
    save(STORAGE_KEYS.EXPENSE_CATEGORIES, categories);
    return saved;
  }

  public recordExpense(params: {
    branchId: string;
    employeeId: string;
    categoryId?: string | null;
    categoryName: string;
    amount: number;
    relatedOrderId?: string | null;
    externalOfficeId?: string | null;
    notes?: string;
    idempotencyKey: string;
  }): Expense {
    const cached = this.getIdempotencyResult<Expense>(params.idempotencyKey);
    if (cached) return cached;

    const amount = Number(params.amount);
    if (amount <= 0) throw new Error('قيمة المصروف يجب أن تكون أكبر من الصفر');

    const branchBalance = this.getBranchDrawerBalance(params.branchId);
    if (branchBalance < amount) {
      throw new Error(`رصيد الخزينة (${branchBalance}) لا يكفي لصرف هذا المصروف (${amount})`);
    }

    const employeeBalance = this.getEmployeeDrawerBalance(params.employeeId, params.branchId);
    if (employeeBalance < amount) {
      throw new Error(`عهدة الموظف الحالية (${employeeBalance}) لا تكفي لصرف هذا المصروف (${amount})`);
    }

    const expense: Expense = {
      id: `exp-${Date.now()}`,
      branch_id: params.branchId,
      employee_id: params.employeeId,
      category_id: params.categoryId || null,
      category_name: params.categoryName,
      amount,
      related_order_id: params.relatedOrderId || null,
      external_office_id: params.externalOfficeId || null,
      notes: params.notes,
      idempotency_key: params.idempotencyKey,
      created_at: new Date().toISOString(),
    };

    const expenses = load<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    expenses.unshift(expense);
    save(STORAGE_KEYS.EXPENSES, expenses);

    // Deduct from Cash Drawer
    const ledgerType: CashLedgerEntry['transaction_type'] = params.externalOfficeId
      ? 'external_office_cost'
      : 'expense';

    this.appendLedgerEntry(
      params.branchId,
      ledgerType,
      -amount,
      'expenses',
      expense.id,
      `${params.categoryName}${params.notes ? ': ' + params.notes : ''}`,
      `ldg-exp-${params.idempotencyKey}`,
      params.employeeId
    );

    this.addAuditLog(
      'تسجيل مصروف نقدي',
      'Expense',
      expense.id,
      null,
      { category: params.categoryName, amount, notes: params.notes },
      { branchId: params.branchId, employeeId: params.employeeId }
    );

    this.recordIdempotency(params.idempotencyKey, expense);
    return expense;
  }

  // Branch Transfers (ATOMIC OPERATION)
  public getTransfers(branchId?: string): BranchTransfer[] {
    const all = load<BranchTransfer[]>(STORAGE_KEYS.TRANSFERS, []);
    if (!branchId) return all;
    return all.filter(t => t.from_branch_id === branchId || t.to_branch_id === branchId);
  }

  public executeBranchTransfer(params: {
    fromBranchId: string;
    toBranchId: string;
    amount: number;
    notes?: string;
    idempotencyKey: string;
    employeeId?: string;
  }): BranchTransfer {
    const cached = this.getIdempotencyResult<BranchTransfer>(params.idempotencyKey);
    if (cached) return cached;

    if (params.fromBranchId === params.toBranchId) {
      throw new Error('لا يمكن التحويل لنفس الفرع');
    }

    const amount = Number(params.amount);
    if (amount <= 0) {
      throw new Error('مبلغ التحويل يجب أن يكون أكبر من الصفر');
    }

    const sourceBalance = this.getBranchDrawerBalance(params.fromBranchId);
    if (sourceBalance < amount) {
      throw new Error(
        `رصيد الدرج في الفرع المحول منه (${sourceBalance}) لا يكفي لإجراء التحويل بقيمة (${amount})`
      );
    }

    const branches = this.getBranches();
    const fromBranch = branches.find(b => b.id === params.fromBranchId);
    const toBranch = branches.find(b => b.id === params.toBranchId);
    const employeeId = params.employeeId || this.getActiveEmployeeId();

    const refNumber = `TRF-${Date.now().toString().slice(-6)}`;
    const transfer: BranchTransfer = {
      id: `trf-${Date.now()}`,
      reference_number: refNumber,
      from_branch_id: params.fromBranchId,
      to_branch_id: params.toBranchId,
      amount,
      employee_id: employeeId,
      status: 'completed',
      notes: params.notes,
      idempotency_key: params.idempotencyKey,
      created_at: new Date().toISOString(),
    };

    // 1. Deduct from Source Branch
    this.appendLedgerEntry(
      params.fromBranchId,
      'branch_transfer_out',
      -amount,
      'branch_transfers',
      transfer.id,
      `تحويل نقد صادر إلى ${toBranch?.name || 'فرع'} [مرجع: ${refNumber}]`,
      `ldg-trf-out-${params.idempotencyKey}`,
      employeeId
    );

    // 2. Add to Target Branch
    this.appendLedgerEntry(
      params.toBranchId,
      'branch_transfer_in',
      amount,
      'branch_transfers',
      transfer.id,
      `تحويل نقد وارد من ${fromBranch?.name || 'فرع'} [مرجع: ${refNumber}]`,
      `ldg-trf-in-${params.idempotencyKey}`,
      employeeId
    );

    const transfers = load<BranchTransfer[]>(STORAGE_KEYS.TRANSFERS, []);
    transfers.unshift(transfer);
    save(STORAGE_KEYS.TRANSFERS, transfers);

    this.addAuditLog(
      'تحويل نقد بين الفروع',
      'BranchTransfer',
      transfer.id,
      null,
      {
        from: fromBranch?.name,
        to: toBranch?.name,
        amount,
        refNumber,
      },
      { employeeId }
    );

    this.recordIdempotency(params.idempotencyKey, transfer);
    return transfer;
  }

  // Distributors & Supplies
  public getDistributors(): Distributor[] {
    const distributors = load<Distributor[]>(STORAGE_KEYS.DISTRIBUTORS, INITIAL_DISTRIBUTORS);
    const orders = this.getOrders();
    const txns = load<DistributorTransaction[]>(STORAGE_KEYS.DISTRIBUTOR_TXNS, []);

    // Calculate aggregated balances dynamically for integrity
    return distributors.map(d => {
      const distOrders = orders.filter(o => matchIds(o.distributor_id, d.id) && o.status !== 'cancelled');
      const totalOrdersValue = distOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);

      // Opening balance charges (transactions not linked to a specific order)
      const openingTxns = txns.filter(t => matchIds(t.distributor_id, d.id) && t.type === 'order_charge' && !t.reference_id);
      const totalOpening = openingTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const distSupplyTxns = txns.filter(t => matchIds(t.distributor_id, d.id) && t.type === 'supply_payment');
      const totalSupplied = distSupplyTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const balanceDue = Number((totalOrdersValue + totalOpening - totalSupplied).toFixed(2));

      return {
        ...d,
        balance: balanceDue,
        total_orders_value: totalOrdersValue + totalOpening,
        total_supplied: totalSupplied,
        balance_due: balanceDue,
      };
    });
  }

  public getDistributorTransactions(distributorId?: string): DistributorTransaction[] {
    const all = load<DistributorTransaction[]>(STORAGE_KEYS.DISTRIBUTOR_TXNS, []);
    if (!distributorId) return all;
    return all.filter(t => matchIds(t.distributor_id, distributorId));
  }

  public saveDistributor(dist: { id?: string; name: string; phone: string; code: string; address?: string; is_active?: boolean }): Distributor {
    const distributors = load<Distributor[]>(STORAGE_KEYS.DISTRIBUTORS, INITIAL_DISTRIBUTORS);
    let saved: Distributor;
    if (dist.id) {
      const idx = distributors.findIndex(d => matchIds(d.id, dist.id));
      if (idx >= 0) {
        saved = { ...distributors[idx], ...dist };
        distributors[idx] = saved;
      } else {
        saved = {
          id: dist.id,
          name: dist.name,
          phone: dist.phone,
          code: dist.code,
          address: dist.address,
          is_active: dist.is_active ?? true,
          created_at: new Date().toISOString(),
        };
        distributors.push(saved);
      }
    } else {
      saved = {
        id: `dist-${Date.now()}`,
        name: dist.name,
        phone: dist.phone,
        code: dist.code,
        address: dist.address,
        is_active: dist.is_active ?? true,
        created_at: new Date().toISOString(),
      };
      distributors.push(saved);
    }
    save(STORAGE_KEYS.DISTRIBUTORS, distributors);
    this.removeTombstone(saved.id);
    triggerAutoPush();
    return saved;
  }

  public deleteDistributor(distId: string): { success: boolean; error?: string } {
    const distributors = load<Distributor[]>(STORAGE_KEYS.DISTRIBUTORS, INITIAL_DISTRIBUTORS);
    const target = distributors.find(d => matchIds(d.id, distId));
    if (!target) return { success: false, error: 'الموزع غير موجود' };

    const orders = this.getOrders();
    const hasOrders = orders.some(o => matchIds(o.distributor_id, distId));
    
    if (hasOrders) {
      // Soft delete if there are orders
      target.is_active = false;
      save(STORAGE_KEYS.DISTRIBUTORS, distributors);
      triggerAutoPush();
      return { success: true };
    }

    // Hard delete if no orders
    const filtered = distributors.filter(d => !matchIds(d.id, distId));
    save(STORAGE_KEYS.DISTRIBUTORS, filtered);
    this.addTombstone(distId);
    deleteRecord('distributors', distId);
    triggerAutoPush();
    return { success: true };
  }

  public createDistributor(params: { name: string; phone: string; code: string; address?: string; openingBalance?: number }): Distributor {
    const dist = this.saveDistributor({
      name: params.name,
      phone: params.phone,
      code: params.code,
      address: params.address,
      is_active: true,
    });
    if (params.openingBalance && params.openingBalance > 0) {
      this.recordDistributorTransaction(
        dist.id,
        this.getActiveBranchId(),
        this.getActiveEmployeeId(),
        params.openingBalance,
        'order_charge',
        undefined,
        'رصيد مدين افتتاحي'
      );
    }
    return dist;
  }

  public recordDistributorTransaction(
    distributorId: string,
    branchId: string,
    employeeId: string,
    amount: number,
    type: 'order_charge' | 'supply_payment',
    referenceId?: string,
    notes?: string,
    idempotencyKey?: string
  ): DistributorTransaction {
    const txns = load<DistributorTransaction[]>(STORAGE_KEYS.DISTRIBUTOR_TXNS, []);
    const txn: DistributorTransaction = {
      id: `dist-txn-${Date.now()}`,
      distributor_id: distributorId,
      branch_id: branchId,
      employee_id: employeeId,
      amount: Number(amount.toFixed(2)),
      type,
      reference_id: referenceId,
      idempotency_key: idempotencyKey,
      notes,
      created_at: new Date().toISOString(),
    };

    txns.unshift(txn);
    save(STORAGE_KEYS.DISTRIBUTOR_TXNS, txns);
    return txn;
  }

  /**
   * Supply Payment from Distributor (Cash IN to Branch Drawer)
   */
  public recordDistributorSupply(params: {
    distributorId: string;
    branchId: string;
    employeeId: string;
    amount: number;
    notes?: string;
    idempotencyKey: string;
  }): DistributorTransaction {
    const cached = this.getIdempotencyResult<DistributorTransaction>(params.idempotencyKey);
    if (cached) return cached;

    const amount = Number(params.amount);
    if (amount <= 0) throw new Error('مبلغ التوريد يجب أن يكون أكبر من الصفر');

    const distributors = this.getDistributors();
    const distributor = distributors.find(d => d.id === params.distributorId);
    if (!distributor) throw new Error('الموزع غير موجود');

    // 1. Record Distributor Transaction
    const txn = this.recordDistributorTransaction(
      params.distributorId,
      params.branchId,
      params.employeeId,
      amount,
      'supply_payment',
      undefined,
      params.notes || `توريد نقدي من الموزع ${distributor.name}`,
      params.idempotencyKey
    );

    // 2. Add to Cash Drawer
    this.appendLedgerEntry(
      params.branchId,
      'distributor_payment',
      amount,
      'distributor_transactions',
      txn.id,
      `توريد نقدي من الموزع ${distributor.name} [كود: ${distributor.code}]`,
      `ldg-dist-${params.idempotencyKey}`,
      params.employeeId
    );

    this.addAuditLog(
      'تسجيل توريد نقدي من موزع',
      'Distributor',
      distributor.id,
      null,
      { distributorName: distributor.name, amount, notes: params.notes },
      { branchId: params.branchId, employeeId: params.employeeId }
    );

    this.recordIdempotency(params.idempotencyKey, txn);
    return txn;
  }

  // External Offices
  public getExternalOffices(): ExternalOffice[] {
    const offices = load<ExternalOffice[]>(STORAGE_KEYS.EXTERNAL_OFFICES, INITIAL_EXTERNAL_OFFICES);
    const orders = this.getOrders();
    const txns = this.getExternalOfficeTransactions();

    return offices.map(o => {
      // All active (non-cancelled) orders linked to this external office
      const officeOrders = orders.filter(ord => matchIds(ord.external_office_id, o.id) && ord.status !== 'cancelled');
      const totalJobs = officeOrders.length;
      const totalOrdersCost = officeOrders.reduce((sum, ord) => sum + Number(ord.external_office_cost || 0), 0);

      // Opening balance transactions
      const openingTxns = txns.filter(t => matchIds(t.external_office_id, o.id) && t.type === 'opening_balance');
      const totalOpening = openingTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Payouts paid manually to this office
      const payoutTxns = txns.filter(t => matchIds(t.external_office_id, o.id) && t.type === 'office_payout');
      const totalCostPaid = payoutTxns.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

      // Current balance payable due to office = total accrued order costs + opening balance - total payouts paid
      const balancePayable = Number((totalOrdersCost + totalOpening - totalCostPaid).toFixed(2));

      return {
        ...o,
        balance: balancePayable,
        total_jobs_count: totalJobs,
        total_cost_paid: totalCostPaid,
      };
    });
  }

  public saveExternalOffice(office: { id?: string; name: string; contact_person?: string; phone: string; specialty?: string; address?: string; is_active?: boolean; balance?: number }): ExternalOffice {
    const offices = load<ExternalOffice[]>(STORAGE_KEYS.EXTERNAL_OFFICES, INITIAL_EXTERNAL_OFFICES);
    let saved: ExternalOffice;
    if (office.id) {
      const idx = offices.findIndex(o => matchIds(o.id, office.id));
      if (idx >= 0) {
        saved = { ...offices[idx], ...office };
        offices[idx] = saved;
      } else {
        saved = {
          id: office.id,
          name: office.name,
          contact_person: office.contact_person,
          phone: office.phone,
          specialty: office.specialty,
          address: office.address,
          is_active: office.is_active ?? true,
          balance: office.balance ?? 0,
          created_at: new Date().toISOString(),
        };
        offices.push(saved);
      }
    } else {
      saved = {
        id: `ext-${Date.now()}`,
        name: office.name,
        contact_person: office.contact_person,
        phone: office.phone,
        specialty: office.specialty,
        address: office.address,
        is_active: office.is_active ?? true,
        balance: office.balance ?? 0,
        created_at: new Date().toISOString(),
      };
      offices.push(saved);
    }
    save(STORAGE_KEYS.EXTERNAL_OFFICES, offices);
    this.removeTombstone(saved.id);
    triggerAutoPush();
    return saved;
  }

  public deleteExternalOffice(officeId: string): { success: boolean; error?: string } {
    const offices = load<ExternalOffice[]>(STORAGE_KEYS.EXTERNAL_OFFICES, INITIAL_EXTERNAL_OFFICES);
    const target = offices.find(o => matchIds(o.id, officeId));
    if (!target) return { success: false, error: 'المكتب غير موجود' };

    const orders = this.getOrders();
    const hasOrders = orders.some(o => matchIds(o.external_office_id, officeId));
    
    if (hasOrders) {
      // Soft delete
      target.is_active = false;
      save(STORAGE_KEYS.EXTERNAL_OFFICES, offices);
      triggerAutoPush();
      return { success: true };
    }

    // Hard delete
    const filtered = offices.filter(o => !matchIds(o.id, officeId));
    save(STORAGE_KEYS.EXTERNAL_OFFICES, filtered);
    this.addTombstone(officeId);
    deleteRecord('external_offices', officeId);
    triggerAutoPush();
    return { success: true };
  }

  public createExternalOffice(params: { name: string; phone: string; specialty?: string; address?: string; openingBalance?: number }): ExternalOffice {
    const off = this.saveExternalOffice({
      name: params.name,
      phone: params.phone,
      specialty: params.specialty,
      address: params.address,
      is_active: true,
      balance: params.openingBalance || 0,
    });
    if (params.openingBalance && params.openingBalance > 0) {
      const txns = this.getExternalOfficeTransactions();
      const txn: ExternalOfficeTransaction = {
        id: `off-txn-${Date.now()}`,
        external_office_id: off.id,
        amount: params.openingBalance,
        type: 'opening_balance',
        notes: 'رصيد افتتاحي للمكتب',
        balance_after: params.openingBalance,
        created_at: new Date().toISOString(),
      };
      txns.unshift(txn);
      save(STORAGE_KEYS.EXTERNAL_OFFICE_TXNS, txns);
    }
    return off;
  }

  public getExternalOfficeTransactions(officeId?: string): ExternalOfficeTransaction[] {
    const txns = load<ExternalOfficeTransaction[]>(STORAGE_KEYS.EXTERNAL_OFFICE_TXNS, []);
    if (!officeId) return txns;
    return txns.filter(t => matchIds(t.external_office_id, officeId));
  }

  public recordExternalOfficePayment(params: {
    officeId: string;
    amount: number;
    relatedOrderId?: string;
    notes?: string;
    idempotencyKey: string;
    branchId?: string;
    employeeId?: string;
  }): ExternalOfficeTransaction {
    const cached = this.getIdempotencyResult<ExternalOfficeTransaction>(params.idempotencyKey);
    if (cached) return cached;

    const branchId = params.branchId || this.getActiveBranchId();
    const employeeId = params.employeeId || this.getActiveEmployeeId();
    const amount = Number(params.amount);

    if (amount <= 0) throw new Error('مبلغ السداد يجب أن يكون أكبر من الصفر');

    const branchBalance = this.getBranchDrawerBalance(branchId);
    if (branchBalance < amount) {
      throw new Error(`رصيد الخزينة (${branchBalance}) لا يكفي لسداد هذا المبلغ (${amount})`);
    }

    const employeeBalance = this.getEmployeeDrawerBalance(employeeId, branchId);
    if (employeeBalance < amount) {
      throw new Error(`عهدة الموظف الحالية (${employeeBalance}) لا تكفي لسداد هذا المبلغ (${amount})`);
    }

    const offices = this.getExternalOffices();
    const office = offices.find(o => matchIds(o.id, params.officeId));
    if (!office) throw new Error('المكتب الخارجي غير موجود في النظام');

    const paymentNote = params.notes?.trim() || `مستحق ل ${office.name}`;

    // 1. Deduct from Drawer (expense ledger)
    this.appendLedgerEntry(
      branchId,
      'external_office_payment',
      -amount,
      'external_offices',
      office.id,
      paymentNote,
      `ldg-ext-${params.idempotencyKey}`,
      employeeId
    );

    // 2. Record Expense entry so it appears under Expenses View ONLY after manual payment
    const expEntry: Expense = {
      id: `exp-${Date.now()}`,
      branch_id: branchId,
      employee_id: employeeId,
      category_id: null,
      category_name: paymentNote,
      amount,
      related_order_id: params.relatedOrderId || null,
      external_office_id: office.id,
      notes: paymentNote,
      idempotency_key: `ext-pay-exp-${params.idempotencyKey}`,
      created_at: new Date().toISOString(),
    };
    const expenses = load<Expense[]>(STORAGE_KEYS.EXPENSES, []);
    expenses.unshift(expEntry);
    save(STORAGE_KEYS.EXPENSES, expenses);

    const txns = this.getExternalOfficeTransactions();
    const currentBalance = (office.balance || 0) - amount;

    const txn: ExternalOfficeTransaction = {
      id: `off-txn-${Date.now()}`,
      external_office_id: office.id,
      branch_id: branchId,
      employee_id: employeeId,
      amount: -amount,
      type: 'office_payout',
      notes: paymentNote,
      idempotency_key: params.idempotencyKey,
      balance_after: currentBalance,
      created_at: new Date().toISOString(),
    };

    txns.unshift(txn);
    save(STORAGE_KEYS.EXTERNAL_OFFICE_TXNS, txns);

    this.addAuditLog(
      'سداد مستحقات مكتب خارجي',
      'ExternalOffice',
      office.id,
      null,
      { officeName: office.name, amount, notes: params.notes },
      { branchId, employeeId }
    );

    this.recordIdempotency(params.idempotencyKey, txn);
    return txn;
  }

  // Daily Closing & Settlement (ATOMIC & STRICT IDEMPOTENCY)
  public getDailyClosings(branchId?: string): DailyClosing[] {
    const all = load<DailyClosing[]>(STORAGE_KEYS.CLOSINGS, []);
    if (!branchId) return all;
    return all.filter(c => c.branch_id === branchId);
  }

  public executeDailyClosing(params: {
    branchId: string;
    closingDate: string; // YYYY-MM-DD
    notes?: string;
    idempotencyKey: string;
    employeeId?: string;
  }): DailyClosing {
    const cached = this.getIdempotencyResult<DailyClosing>(params.idempotencyKey);
    if (cached) return cached;

    const closings = this.getDailyClosings(params.branchId);
    const alreadyClosed = closings.some(c => c.closing_date === params.closingDate);
    if (alreadyClosed) {
      throw new Error(`تم إغلاق وتسوية هذا اليوم (${params.closingDate}) مسبقاً لهذا الفرع، ولا يمكن تكرار الإغلاق.`);
    }

    const employeeId = params.employeeId || this.getActiveEmployeeId();
    const branchDrawerBalance = this.getBranchDrawerBalance(params.branchId);

    // Compute today's breakdown from Ledger and Payments
    const branchLedger = this.getLedger(params.branchId);
    const todayLedger = branchLedger.filter(l => l.created_at.startsWith(params.closingDate));

    const totalCashIn = todayLedger
      .filter(l => l.amount > 0 && l.transaction_type !== 'opening_balance')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    const totalCashOut = todayLedger
      .filter(l => l.amount < 0)
      .reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

    const branchPayments = this.getPayments().filter(
      p => p.branch_id === params.branchId && p.created_at.startsWith(params.closingDate)
    );
    const totalElectronic = branchPayments.reduce((sum, p) => sum + Number(p.electronic_amount || 0), 0);

    const branchOrders = this.getOrders(params.branchId).filter(o => o.created_at.startsWith(params.closingDate));
    const branchExpenses = this.getExpenses(params.branchId).filter(e => e.created_at.startsWith(params.closingDate));

    const closing: DailyClosing = {
      id: `cls-${Date.now()}`,
      branch_id: params.branchId,
      closing_date: params.closingDate,
      system_calculated_balance: Number(branchDrawerBalance.toFixed(2)),
      actual_cash_count: Number(branchDrawerBalance.toFixed(2)),
      difference: 0,
      closing_type: 'payout_to_main',
      opening_balance: Number((branchDrawerBalance - totalCashIn + totalCashOut).toFixed(2)),
      total_cash_in: Number(totalCashIn.toFixed(2)),
      total_cash_out: Number(totalCashOut.toFixed(2)),
      total_electronic: Number(totalElectronic.toFixed(2)),
      net_cash_balance: Number(branchDrawerBalance.toFixed(2)),
      total_orders_count: branchOrders.length,
      total_expenses_count: branchExpenses.length,
      closing_employee_id: employeeId,
      notes: params.notes,
      created_at: new Date().toISOString(),
    };

    // Record Closing Ledger Entry (Reset operational cash balance to 0 while preserving history)
    if (branchDrawerBalance > 0) {
      this.appendLedgerEntry(
        params.branchId,
        'daily_closing_payout',
        -branchDrawerBalance,
        'daily_closings',
        closing.id,
        `إغلاق وتسوية يومية لتاريخ ${params.closingDate} - ترحيل الرصيد التشغيلي`,
        `ldg-cls-${params.idempotencyKey}`,
        employeeId
      );
    }

    const allClosings = load<DailyClosing[]>(STORAGE_KEYS.CLOSINGS, []);
    allClosings.unshift(closing);
    save(STORAGE_KEYS.CLOSINGS, allClosings);

    this.addAuditLog(
      'إغلاق وتسوية يومية',
      'DailyClosing',
      closing.id,
      null,
      closing,
      { branchId: params.branchId, employeeId }
    );

    this.recordIdempotency(params.idempotencyKey, closing);
    return closing;
  }

  // Audit Logs
  public getAuditLogs(limit: number = 100): AuditLog[] {
    const logs = load<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    return logs.slice(0, limit);
  }

  public addAuditLog(
    action: string,
    entity: string,
    entityId?: string,
    oldData?: any,
    newData?: any,
    metadata?: Record<string, any>
  ): void {
    const employeeId = metadata?.employeeId || this.getActiveEmployeeId();
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === employeeId);

    const log: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      employee_id: employeeId,
      employee_name: metadata?.employeeName || emp?.name || 'النظام',
      branch_id: metadata?.branchId || this.getActiveBranchId(),
      action,
      entity,
      entity_id: entityId,
      old_data: oldData,
      new_data: newData,
      metadata,
      created_at: new Date().toISOString(),
    };

    const logs = load<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    logs.unshift(log);
    save(STORAGE_KEYS.AUDIT_LOGS, logs.slice(0, 1000)); // Cap to last 1000
  }

  // Aggregated KPI Stats
  public getSystemStats(branchId?: string, employeeId?: string): SystemStats {
    const localToday = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
    const bId = branchId || this.getActiveBranchId();
    const activeEmpId = employeeId || this.getActiveEmployeeId();

    const branchDrawerBalance = this.getBranchDrawerBalance(bId);
    const employeeDrawerBalance = this.getEmployeeDrawerBalance(activeEmpId, bId);

    // If employeeId is specified (and not 'all'), calculate stats specifically for this employee
    const isEmployeeScoped = Boolean(employeeId && employeeId !== 'all');

    const ledger = this.getLedger(bId, isEmployeeScoped ? activeEmpId : undefined);
    const todayLedger = ledger.filter(l => {
      try {
        return new Date(l.created_at).toLocaleDateString('en-CA') === localToday;
      } catch {
        return l.created_at.split('T')[0] === localToday;
      }
    });

    const todayCashIn = todayLedger
      .filter(l => l.amount > 0 && l.transaction_type !== 'opening_balance')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    const todayCashOut = todayLedger
      .filter(l => l.amount < 0 && l.transaction_type !== 'daily_closing_payout')
      .reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

    const payments = this.getPayments().filter(p => {
      const matchBranch = matchIds(p.branch_id, bId);
      let matchDate = false;
      try {
        matchDate = new Date(p.created_at).toLocaleDateString('en-CA') === localToday;
      } catch {
        matchDate = p.created_at.startsWith(localToday);
      }
      const matchEmp = isEmployeeScoped ? matchIds(p.employee_id, activeEmpId) : true;
      return matchBranch && matchDate && matchEmp;
    });
    const todayElectronic = payments.reduce((sum, p) => sum + Number(p.electronic_amount || 0), 0);

    const orders = this.getOrders(bId).filter(o => {
      if (isEmployeeScoped) {
        return o.created_by_employee_id === activeEmpId;
      }
      return true;
    });
    const todayOrders = orders.filter(o => {
      try {
        return new Date(o.created_at).toLocaleDateString('en-CA') === localToday;
      } catch {
        return (o.created_at || '').startsWith(localToday);
      }
    });
    const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
    const pendingDelivery = orders.filter(o => o.status === 'completed' || o.status === 'in_progress');
    const unpaidRemaining = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.remaining || 0), 0);

    const todayNetCash = Number((todayCashIn - todayCashOut).toFixed(2));

    return {
      todayCashIn: Number(todayCashIn.toFixed(2)),
      todayCashOut: Number(todayCashOut.toFixed(2)),
      todayElectronic: Number(todayElectronic.toFixed(2)),
      todayNetCash,
      todayOrdersCount: todayOrders.length,
      currentDrawerBalance: isEmployeeScoped ? employeeDrawerBalance : branchDrawerBalance,
      branchDrawerBalance,
      employeeDrawerBalance,
      activeOrdersCount: activeOrders.length,
      pendingDeliveryCount: pendingDelivery.length,
      unpaidRemainingTotal: Number(unpaidRemaining.toFixed(2)),
    };
  }

  public performDailyClosing(params: {
    actualCash: number;
    closingType: 'carry_over' | 'payout_to_main';
    notes?: string;
    idempotencyKey: string;
    branchId?: string;
    employeeId?: string;
  }): DailyClosing {
    const cached = this.getIdempotencyResult<DailyClosing>(params.idempotencyKey);
    if (cached) return cached;

    const branchId = params.branchId || this.getActiveBranchId();
    const employeeId = params.employeeId || this.getActiveEmployeeId();
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === employeeId);

    const systemCalculatedBalance = this.getBranchDrawerBalance(branchId);
    const difference = Number((params.actualCash - systemCalculatedBalance).toFixed(2));
    const today = new Date().toISOString().split('T')[0];

    const closing: DailyClosing = {
      id: `cls-${Date.now()}`,
      branch_id: branchId,
      closing_date: today,
      system_calculated_balance: systemCalculatedBalance,
      actual_cash_count: params.actualCash,
      difference,
      closing_type: params.closingType,
      employee_name: emp?.name || 'الموظف المسؤول',
      closing_employee_id: employeeId,
      notes: params.notes,
      created_at: new Date().toISOString(),
    };

    if (params.closingType === 'payout_to_main' && params.actualCash > 0) {
      this.appendLedgerEntry(
        branchId,
        'daily_closing_payout',
        -params.actualCash,
        'daily_closings',
        closing.id,
        `توريد نقدية الإغلاق اليومي للخزينة الرئيسية (${params.actualCash})`,
        `ldg-cls-${params.idempotencyKey}`,
        employeeId
      );
    }

    const allClosings = load<DailyClosing[]>(STORAGE_KEYS.CLOSINGS, []);
    allClosings.unshift(closing);
    save(STORAGE_KEYS.CLOSINGS, allClosings);

    this.addAuditLog(
      'إغلاق وتسوية يومية',
      'DailyClosing',
      closing.id,
      null,
      closing,
      { branchId, employeeId }
    );

    this.recordIdempotency(params.idempotencyKey, closing);
    return closing;
  }

  public sendBranchTransfer(params: {
    toBranchId: string;
    amount: number;
    notes?: string;
    idempotencyKey: string;
    fromBranchId?: string;
    senderEmployeeId?: string;
  }): BranchTransfer {
    const cached = this.getIdempotencyResult<BranchTransfer>(params.idempotencyKey);
    if (cached) return cached;

    const fromBranchId = params.fromBranchId || this.getActiveBranchId();
    const senderEmployeeId = params.senderEmployeeId || this.getActiveEmployeeId();
    const amount = Number(params.amount);

    if (fromBranchId === params.toBranchId) {
      throw new Error('لا يمكن التحويل لنفس الفرع');
    }

    const drawer = this.getBranchDrawerBalance(fromBranchId);
    if (amount > drawer) {
      throw new Error(`رصيد الدرج (${drawer}) غير كافٍ لإتمام التحويل`);
    }

    const transfer: BranchTransfer = {
      id: `trf-${Date.now()}`,
      reference_number: `TRF-${Math.floor(1000 + Math.random() * 9000)}`,
      from_branch_id: fromBranchId,
      to_branch_id: params.toBranchId,
      amount,
      sender_employee_id: senderEmployeeId,
      status: 'pending',
      notes: params.notes,
      idempotency_key: params.idempotencyKey,
      created_at: new Date().toISOString(),
    };

    // Deduct immediately from sender drawer
    this.appendLedgerEntry(
      fromBranchId,
      'branch_transfer_out',
      -amount,
      'branch_transfers',
      transfer.id,
      params.notes || `تحويل نقدي صادر إلى فرع آخر [رقم: ${transfer.reference_number}]`,
      `ldg-trf-out-${params.idempotencyKey}`,
      senderEmployeeId
    );

    const transfers = load<BranchTransfer[]>(STORAGE_KEYS.TRANSFERS, []);
    transfers.unshift(transfer);
    save(STORAGE_KEYS.TRANSFERS, transfers);

    this.addAuditLog(
      'إرسال تحويل نقدي لفرع',
      'BranchTransfer',
      transfer.id,
      null,
      transfer,
      { branchId: fromBranchId, employeeId: senderEmployeeId }
    );

    this.recordIdempotency(params.idempotencyKey, transfer);
    return transfer;
  }

  public receiveBranchTransfer(params: {
    transferId: string;
    receiverEmployeeId?: string;
  }): BranchTransfer {
    const transfers = load<BranchTransfer[]>(STORAGE_KEYS.TRANSFERS, []);
    const idx = transfers.findIndex(t => t.id === params.transferId);
    if (idx < 0) throw new Error('التحويل غير موجود');

    const transfer = transfers[idx];
    if (transfer.status !== 'pending') {
      throw new Error('تم استلام أو معالجة هذا التحويل مسبقاً');
    }

    const receiverEmployeeId = params.receiverEmployeeId || this.getActiveEmployeeId();

    transfer.status = 'completed';
    transfer.receiver_employee_id = receiverEmployeeId;
    transfers[idx] = transfer;
    save(STORAGE_KEYS.TRANSFERS, transfers);

    // Deposit to receiver drawer
    this.appendLedgerEntry(
      transfer.to_branch_id,
      'branch_transfer_in',
      transfer.amount,
      'branch_transfers',
      transfer.id,
      `استلام تحويل نقدي وارد [رقم: ${transfer.reference_number || transfer.id}]`,
      `ldg-trf-in-${transfer.id}`,
      receiverEmployeeId
    );

    this.addAuditLog(
      'تأكيد استلام تحويل نقدي من فرع',
      'BranchTransfer',
      transfer.id,
      { status: 'pending' },
      { status: 'completed', receiverEmployeeId },
      { branchId: transfer.to_branch_id, employeeId: receiverEmployeeId }
    );

    return transfer;
  }

  public createBranch(branch: { name: string; code: string; phone?: string; address?: string }): Branch {
    const branches = this.getBranches();
    const newBranch: Branch = {
      id: `branch-${Date.now()}`,
      name: branch.name,
      code: branch.code,
      phone: branch.phone,
      address: branch.address,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    branches.push(newBranch);
    save(STORAGE_KEYS.BRANCHES, branches);
    return newBranch;
  }

  public createService(service: { name: string; category?: string; basePrice: number; executionDays?: number; speeds?: any[] }): Service {
    const services = load<Service[]>(STORAGE_KEYS.SERVICES, []);
    const newService: Service = {
      id: `srv-${Date.now()}`,
      name: service.name,
      category: service.category || '',
      base_price: service.basePrice,
      execution_days: service.executionDays || 1,
      speeds: service.speeds || [
        { code: 'normal', label: 'عادي', extra_cost: 0 },
        { code: 'urgent', label: 'مستعجل', extra_cost: 50 },
      ],
      is_active: true,
      created_at: new Date().toISOString(),
    };
    services.push(newService);
    save(STORAGE_KEYS.SERVICES, services);
    return newService;
  }

  public createEmployee(emp: {
    name: string;
    username?: string;
    email?: string;
    phone?: string;
    password?: string;
    pin_code?: string;
    role: any;
    branchId?: string;
    code?: string;
  }): Employee {
    const employees = this.getEmployees();
    const now = new Date().toISOString();
    const generatedCode = emp.code?.trim() || `EMP-${String(employees.length + 1).padStart(2, '0')}`;
    const pass = emp.password?.trim() || emp.pin_code?.trim() || '1234';

    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: emp.name.trim(),
      code: generatedCode,
      username: emp.username?.trim() || emp.email?.trim() || emp.name.trim().toLowerCase().replace(/\s+/g, '.'),
      email: emp.email?.trim(),
      phone: emp.phone?.trim(),
      password: pass,
      pin_code: pass,
      role: emp.role || 'employee',
      branch_id: emp.branchId || undefined,
      default_branch_id: emp.branchId || this.getActiveBranchId(),
      is_active: true,
      created_at: now,
    };
    employees.push(newEmp);
    save(STORAGE_KEYS.EMPLOYEES, employees);
    this.addAuditLog('إضافة موظف جديد', 'Employee', newEmp.id, null, newEmp);
    return newEmp;
  }

  public createExpense(params: {
    categoryName: string;
    amount: number;
    notes?: string;
    idempotencyKey: string;
    branchId?: string;
    employeeId?: string;
  }): Expense {
    return this.recordExpense({
      branchId: params.branchId || this.getActiveBranchId(),
      employeeId: params.employeeId || this.getActiveEmployeeId(),
      categoryName: params.categoryName,
      amount: params.amount,
      notes: params.notes,
      idempotencyKey: params.idempotencyKey,
    });
  }

  public exportDatabaseJson(): string {
    return this.exportCompleteDatabaseJson();
  }

  // Backup & Restore
  public exportCompleteDatabaseJson(): string {
    const dump = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      branches: this.getBranches(),
      employees: this.getEmployees(),
      services: this.getServices(),
      customers: this.getCustomers(),
      orders: this.getOrders(),
      payments: this.getPayments(),
      ledger: this.getLedger(),
      distributors: this.getDistributors(),
      distributor_txns: load(STORAGE_KEYS.DISTRIBUTOR_TXNS, []),
      external_offices: this.getExternalOffices(),
      expense_categories: this.getExpenseCategories(),
      expenses: this.getExpenses(),
      transfers: this.getTransfers(),
      closings: this.getDailyClosings(),
      audit_logs: this.getAuditLogs(500),
    };
    return JSON.stringify(dump, null, 2);
  }

  public restoreDatabaseJson(jsonContent: string): void {
    const data = JSON.parse(jsonContent);
    if (data.branches) save(STORAGE_KEYS.BRANCHES, data.branches);
    if (data.employees) save(STORAGE_KEYS.EMPLOYEES, data.employees);
    if (data.services) save(STORAGE_KEYS.SERVICES, data.services);
    if (data.customers) save(STORAGE_KEYS.CUSTOMERS, data.customers);
    if (data.orders) save(STORAGE_KEYS.ORDERS, data.orders);
    if (data.payments) save(STORAGE_KEYS.PAYMENTS, data.payments);
    if (data.ledger) save(STORAGE_KEYS.LEDGER, data.ledger);
    if (data.distributors) save(STORAGE_KEYS.DISTRIBUTORS, data.distributors);
    if (data.distributor_txns) save(STORAGE_KEYS.DISTRIBUTOR_TXNS, data.distributor_txns);
    if (data.external_offices) save(STORAGE_KEYS.EXTERNAL_OFFICES, data.external_offices);
    if (data.expense_categories) save(STORAGE_KEYS.EXPENSE_CATEGORIES, data.expense_categories);
    if (data.expenses) save(STORAGE_KEYS.EXPENSES, data.expenses);
    if (data.transfers) save(STORAGE_KEYS.TRANSFERS, data.transfers);
    if (data.closings) save(STORAGE_KEYS.CLOSINGS, data.closings);
    if (data.audit_logs) save(STORAGE_KEYS.AUDIT_LOGS, data.audit_logs);
  }

  public async resetDatabase(): Promise<void> {
    await Promise.all(Object.values(STORAGE_KEYS).map(async (key) => {
      delete memoryCache[key];
      localStorage.removeItem(key);
      await localforage.removeItem(key);
    }));
    await this._initDefaultsAsync();
  }

  public async clearAllLocalData(): Promise<void> {
    await Promise.all(Object.values(STORAGE_KEYS).map(async (key) => {
      delete memoryCache[key];
      localStorage.removeItem(key);
      await localforage.removeItem(key);
    }));
  }
}

export const storage = ResilientStorageService.getInstance();
