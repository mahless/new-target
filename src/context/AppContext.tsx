/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * App State Context & Reactive Orchestrator
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  Branch,
  Employee,
  Service,
  Customer,
  ServiceOrder,
  Payment,
  CashLedgerEntry,
  Distributor,
  ExternalOffice,
  ExpenseCategory,
  Expense,
  BranchTransfer,
  DailyClosing,
  AuditLog,
  SystemStats,
  FinancialViewScope,
} from '../types';
import { storage, initializeStorage } from '../lib/storage';
import { isSupabaseConfigured, supabaseSyncService, subscribeToRealtimeChanges, clearAllLocalData } from '../lib/supabase';

export type NavigationTab =
  | 'operations'
  | 'new_service'
  | 'orders'
  | 'treasury'
  | 'expenses'
  | 'distributors'
  | 'external_offices'
  | 'transfers'
  | 'reports'
  | 'audit_logs'
  | 'settings';

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface AppContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  activeBranch: Branch | null;
  setActiveBranchId: (branchId: string) => void;
  activeEmployee: Employee | null;
  setActiveEmployeeId: (empId: string) => void;
  financialViewScope: FinancialViewScope;
  setFinancialViewScope: (scope: FinancialViewScope) => void;
  branches: Branch[];
  employees: Employee[];
  services: Service[];
  customers: Customer[];
  orders: ServiceOrder[];
  payments: Payment[];
  ledger: CashLedgerEntry[];
  distributors: Distributor[];
  externalOffices: ExternalOffice[];
  expenseCategories: ExpenseCategory[];
  expenses: Expense[];
  transfers: BranchTransfer[];
  dailyClosings: DailyClosing[];
  auditLogs: AuditLog[];
  stats: SystemStats;
  drawerBalance: number;
  employeeDrawerBalance: number;
  branchDrawerBalance: number;
  isOnline: boolean;
  refreshData: () => void;
  wipeLocalData: () => void;
  toasts: ToastNotification[];
  showToast: (type: ToastNotification['type'], title: string, message: string) => void;
  removeToast: (id: string) => void;
  generateIdempotencyKey: (prefix?: string) => string;
  selectedOrderIdForModal: string | null;
  setSelectedOrderIdForModal: (id: string | null) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<NavigationTab>('operations');
  const [financialViewScope, setFinancialViewScopeState] = useState<FinancialViewScope>('employee');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledger, setLedger] = useState<CashLedgerEntry[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [externalOffices, setExternalOffices] = useState<ExternalOffice[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transfers, setTransfers] = useState<BranchTransfer[]>([]);
  const [dailyClosings, setDailyClosings] = useState<DailyClosing[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string>('b1-dokki');
  const [activeEmployeeId, setActiveEmployeeIdState] = useState<string>('emp-1');
  const [stats, setStats] = useState<SystemStats>({
    todayCashIn: 0,
    todayCashOut: 0,
    todayElectronic: 0,
    currentDrawerBalance: 0,
    branchDrawerBalance: 0,
    employeeDrawerBalance: 0,
    activeOrdersCount: 0,
    pendingDeliveryCount: 0,
    unpaidRemainingTotal: 0,
  });
  const [drawerBalance, setDrawerBalance] = useState<number>(0);
  const [employeeDrawerBalance, setEmployeeDrawerBalance] = useState<number>(0);
  const [branchDrawerBalance, setBranchDrawerBalance] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [selectedOrderIdForModal, setSelectedOrderIdForModal] = useState<string | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastNotification['type'], title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  // Online / Offline monitor & Realtime Subscription
  useEffect(() => {
    if (isInitializing) return;

    const handleOnline = () => {
      setIsOnline(true);
      showToast('success', 'تمت استعادة الاتصال', 'النظام متصل بالشبكة ويعمل بحالة ممتازة.');
      if (isSupabaseConfigured) {
        supabaseSyncService.pullFromSupabase().then(() => refreshData());
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('warning', 'وضع عدم الاتصال', 'تم تفعيل التخزين المحلي الآمن. لن تفقد أي عمليات.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial background pull on mount if configured
    if (isSupabaseConfigured) {
      supabaseSyncService.pullFromSupabase().then(() => refreshData());
    }

    // Subscribe to Supabase Realtime DB changes
    const unsubscribe = subscribeToRealtimeChanges(() => {
      refreshData();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [isInitializing]);

  const refreshData = useCallback(() => {
    const allBranches = storage.getBranches();
    const allEmployees = storage.getEmployees();
    const allServices = storage.getServices();
    const allCustomers = storage.getCustomers();
    const allOrders = storage.getOrders();
    const allPayments = storage.getPayments();
    const allDistributors = storage.getDistributors();
    const allExtOffices = storage.getExternalOffices();
    const allExpCats = storage.getExpenseCategories();
    const allExpenses = storage.getExpenses();
    const allTransfers = storage.getTransfers();
    const allClosings = storage.getDailyClosings();
    const allAuditLogs = storage.getAuditLogs(100);

    const curBranchId = storage.getActiveBranchId();
    const curEmpId = storage.getActiveEmployeeId();

    setBranches(allBranches);
    setEmployees(allEmployees);
    setServices(allServices);
    setCustomers(allCustomers);
    setOrders(allOrders);
    setPayments(allPayments);
    setDistributors(allDistributors);
    setExternalOffices(allExtOffices);
    setExpenseCategories(allExpCats);
    setExpenses(allExpenses);
    setTransfers(allTransfers);
    setDailyClosings(allClosings);
    setAuditLogs(allAuditLogs);

    setActiveBranchIdState(curBranchId);
    setActiveEmployeeIdState(curEmpId);

    const branchBal = storage.getBranchDrawerBalance(curBranchId);
    const empBal = storage.getEmployeeDrawerBalance(curEmpId, curBranchId);
    setBranchDrawerBalance(branchBal);
    setEmployeeDrawerBalance(empBal);

    const activeBal = financialViewScope === 'employee' ? empBal : branchBal;
    setDrawerBalance(activeBal);

    const scopedLedger = financialViewScope === 'employee'
      ? storage.getLedger(curBranchId, curEmpId)
      : storage.getLedger(curBranchId);
    setLedger(scopedLedger);

    const st = storage.getSystemStats(curBranchId, financialViewScope === 'employee' ? curEmpId : undefined);
    setStats(st);
  }, [financialViewScope]);

  useEffect(() => {
    initializeStorage().then(() => {
      setIsInitializing(false);
    }).catch(err => {
      console.error('Failed to initialize storage', err);
      setIsInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    refreshData();
  }, [refreshData, isInitializing]);

  // Automatic Midnight Day Rollover (تصفير وإعادة تهيئة أرقام وإحصائيات اليوم تلقائياً عند 12:00 منتصف الليل)
  useEffect(() => {
    let lastTrackedDate = new Date().toLocaleDateString('en-CA');

    const checkMidnightRollover = () => {
      const currentDate = new Date().toLocaleDateString('en-CA');
      if (currentDate !== lastTrackedDate) {
        lastTrackedDate = currentDate;
        console.log('[Midnight Reset] New day detected:', currentDate, '- Resetting daily counters and refreshing data.');
        refreshData();
        showToast('info', 'بدء يوم عمل جديد', 'تم بدء يوم عمل جديد وتصفير أرقام الخزينة اليومية تلقائياً.');
      }
    };

    // Check every 10 seconds for instant rollover at 12:00 AM
    const interval = setInterval(checkMidnightRollover, 10000);

    // Also check on window focus / tab activation
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkMidnightRollover();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkMidnightRollover);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkMidnightRollover);
    };
  }, [refreshData, showToast]);

  const setFinancialViewScope = (scope: FinancialViewScope) => {
    setFinancialViewScopeState(scope);
    const curBranchId = storage.getActiveBranchId();
    const curEmpId = storage.getActiveEmployeeId();
    const branchBal = storage.getBranchDrawerBalance(curBranchId);
    const empBal = storage.getEmployeeDrawerBalance(curEmpId, curBranchId);

    setDrawerBalance(scope === 'employee' ? empBal : branchBal);
    const scopedLedger = scope === 'employee'
      ? storage.getLedger(curBranchId, curEmpId)
      : storage.getLedger(curBranchId);
    setLedger(scopedLedger);
    const st = storage.getSystemStats(curBranchId, scope === 'employee' ? curEmpId : undefined);
    setStats(st);

    const emp = storage.getEmployees().find(e => e.id === curEmpId);
    const b = storage.getBranches().find(item => item.id === curBranchId);
    if (scope === 'employee') {
      showToast('info', 'عرض عهدة الموظف', `تم تحويل العرض المالي لعهدة الموظف: ${emp?.name || ''}`);
    } else {
      showToast('info', 'عرض إجمالي الفرع', `تم تحويل العرض المالي لإجمالي خزينة فرع: ${b?.name || ''}`);
    }
  };

  const setActiveBranchId = (branchId: string) => {
    storage.setActiveBranchId(branchId);
    setActiveBranchIdState(branchId);
    refreshData();
    const b = storage.getBranches().find(item => item.id === branchId);
    showToast('info', 'تم تغيير الفرع النشط', `الفرع النشط الآن: ${b?.name || branchId}`);
  };

  const setActiveEmployeeId = (empId: string) => {
    storage.setActiveEmployeeId(empId);
    setActiveEmployeeIdState(empId);
    refreshData();
    const emp = storage.getEmployees().find(item => item.id === empId);
    showToast('info', 'تبديل الموظف المسؤول', `الموظف الحالي: ${emp?.name || empId}`);
  };

  const generateIdempotencyKey = (prefix = 'idem'): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0] || null;
  const activeEmployee = employees.find(e => e.id === activeEmployeeId) || employees[0] || null;

  const wipeLocalData = () => {
    clearAllLocalData();
    refreshData();
    showToast('info', 'تم تفريغ البيانات المحلية', 'تم مسح جميع البيانات المخزنة محلياً بنجاح.');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900" dir="rtl">
        <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full border border-gray-100 dark:border-gray-700">
          <div className="relative w-16 h-16 flex items-center justify-center mb-6">
            <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 dark:border-indigo-400 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">جاري تهيئة النظام...</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">يرجى الانتظار بينما نقوم بتجهيز قواعد البيانات المحلية.</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        activeBranch,
        setActiveBranchId,
        activeEmployee,
        setActiveEmployeeId,
        financialViewScope,
        setFinancialViewScope,
        branches,
        employees,
        services,
        customers,
        orders,
        payments,
        ledger,
        distributors,
        externalOffices,
        expenseCategories,
        expenses,
        transfers,
        dailyClosings,
        auditLogs,
        stats,
        drawerBalance,
        employeeDrawerBalance,
        branchDrawerBalance,
        isOnline,
        refreshData,
        wipeLocalData,
        toasts,
        showToast,
        removeToast,
        generateIdempotencyKey,
        selectedOrderIdForModal,
        setSelectedOrderIdForModal,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar: () => setIsSidebarOpen(prev => !prev),
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
