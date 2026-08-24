/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Esnad Multi-Branch Government Services Management System
 */

export interface Branch {
  id: string;
  name: string;
  code: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export type EmployeeRole = 'manager' | 'employee' | 'viewer';

export interface Employee {
  id: string;
  name: string;
  code?: string;
  username?: string;
  email?: string;
  phone?: string;
  pin_code?: string;
  password?: string;
  branch_id?: string;
  default_branch_id?: string;
  role: EmployeeRole;
  is_active: boolean;
  created_at: string;
}

export interface ServiceSpeed {
  code: string; // 'normal' | 'urgent' | 'instant' | 'vip' | custom
  label: string; // عادي، مستعجل، فوري، VIP
  extra_cost: number;
  days?: number;
}

export type ServiceSpeedOption = ServiceSpeed;

export interface ServiceCustomFieldConfig {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: string[]; // if select
  required: boolean;
  placeholder?: string;
}

export interface Service {
  id: string;
  name: string;
  category?: string;
  speeds: ServiceSpeed[];
  fields_config?: ServiceCustomFieldConfig[];
  base_price: number;
  execution_days?: number;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  national_id?: string;
  total_orders?: number;
  created_at: string;
}

export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled';
export type FormSource = 'internal' | 'external';
export type ElectronicType = 'wallet' | 'instapay' | 'pos' | null;

export interface ServiceOrder {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_national_id?: string;
  service_id: string;
  service_name: string;
  speed: string;
  form_barcode?: string;
  form_source?: FormSource;
  custom_fields_data?: Record<string, any>;
  receipt_number?: string;
  description?: string;
  notes?: string;
  status: OrderStatus;
  price: number;
  total_paid: number;
  remaining: number;
  cash_amount?: number;
  electronic_amount?: number;
  distributor_id?: string | null;
  external_office_id?: string | null;
  external_office_cost: number;
  office_margin: number;
  creation_branch_id: string;
  current_branch_id: string;
  delivery_branch_id?: string | null;
  created_by_employee_id: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  branch_id: string;
  employee_id: string;
  amount: number;
  cash_amount: number;
  electronic_amount: number;
  electronic_type: ElectronicType;
  receipt_number?: string;
  description?: string;
  notes?: string;
  idempotency_key: string;
  created_at: string;
}

export type LedgerTransactionType =
  | 'customer_cash_payment'
  | 'customer_refund'
  | 'distributor_payment'
  | 'distributor_supply'
  | 'expense'
  | 'external_office_cost'
  | 'external_office_payment'
  | 'branch_transfer_in'
  | 'branch_transfer_out'
  | 'correction'
  | 'opening_balance'
  | 'daily_closing_payout';

export interface CashLedgerEntry {
  id: string;
  branch_id: string;
  transaction_type: LedgerTransactionType;
  amount: number; // positive for in, negative for out
  balance_after: number;
  reference_table?: string;
  reference_id?: string;
  employee_id?: string;
  idempotency_key?: string;
  receipt_number?: string;
  description?: string;
  notes?: string;
  created_at: string;
}

export interface Distributor {
  id: string;
  name: string;
  phone: string;
  code: string;
  address?: string;
  is_active: boolean;
  balance?: number;
  total_orders_value?: number;
  total_supplied?: number;
  balance_due?: number;
  created_at: string;
}

export interface DistributorTransaction {
  id: string;
  distributor_id: string;
  branch_id?: string;
  employee_id?: string;
  amount: number;
  type: 'order_charge' | 'supply_payment' | 'opening_balance';
  reference_id?: string;
  idempotency_key?: string;
  receipt_number?: string;
  description?: string;
  notes?: string;
  balance_after?: number;
  created_at: string;
}

export interface ExternalOffice {
  id: string;
  name: string;
  contact_person?: string;
  phone: string;
  specialty?: string;
  address?: string;
  is_active: boolean;
  balance?: number;
  total_jobs_count?: number;
  total_cost_paid?: number;
  created_at: string;
}

export interface ExternalOfficeTransaction {
  id: string;
  external_office_id: string;
  branch_id?: string;
  employee_id?: string;
  amount: number;
  type: 'service_order_cost' | 'office_payout' | 'opening_balance';
  reference_id?: string;
  idempotency_key?: string;
  receipt_number?: string;
  description?: string;
  notes?: string;
  balance_after: number;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  branch_id: string;
  employee_id: string;
  category_id?: string | null;
  category?: string;
  category_name: string;
  amount: number;
  related_order_id?: string | null;
  external_office_id?: string | null;
  receipt_number?: string;
  description?: string;
  notes?: string;
  idempotency_key: string;
  created_at: string;
}

export interface BranchTransfer {
  id: string;
  reference_number?: string;
  from_branch_id: string;
  to_branch_id: string;
  amount: number;
  sender_employee_id?: string;
  receiver_employee_id?: string;
  employee_id?: string;
  status: 'pending' | 'completed' | 'rejected';
  receipt_number?: string;
  description?: string;
  notes?: string;
  idempotency_key: string;
  created_at: string;
}

export interface DailyClosing {
  id: string;
  branch_id: string;
  closing_date: string; // YYYY-MM-DD
  opening_balance?: number;
  system_calculated_balance: number;
  actual_cash_count: number;
  difference: number;
  closing_type: 'carry_over' | 'payout_to_main';
  total_cash_in?: number;
  total_cash_out?: number;
  total_electronic?: number;
  net_cash_balance?: number;
  total_orders_count?: number;
  total_expenses_count?: number;
  employee_name?: string;
  closing_employee_id?: string;
  receipt_number?: string;
  description?: string;
  notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  employee_id?: string;
  employee_name: string;
  branch_id?: string;
  action: string;
  entity?: string;
  entity_name?: string;
  entity_id?: string;
  old_data?: any;
  new_data?: any;
  changes?: any;
  metadata?: Record<string, any>;
  created_at: string;
}

export type FinancialViewScope = 'employee' | 'branch';

export interface SystemStats {
  todayCashIn: number;
  todayCashOut: number;
  todayElectronic: number;
  todayNetCash?: number;
  todayOrdersCount?: number;
  currentDrawerBalance: number;
  branchDrawerBalance?: number;
  employeeDrawerBalance?: number;
  activeOrdersCount: number;
  pendingDeliveryCount: number;
  unpaidRemainingTotal: number;
}

