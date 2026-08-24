/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Ergonomic Enterprise AppLayout with Dynamic View Routing
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { Sidebar } from '../common/Sidebar';
import { ToastContainer } from '../common/ToastContainer';
import { LoginScreen } from '../common/LoginScreen';
import { OperationsCenter } from '../operations/OperationsCenter';
import { NewServiceOrder } from '../services/NewServiceOrder';
import { OrdersList } from '../orders/OrdersList';
import { TreasuryView } from '../treasury/TreasuryView';
import { ExpensesView } from '../expenses/ExpensesView';
import { DistributorsView } from '../distributors/DistributorsView';
import { ExternalOfficesView } from '../offices/ExternalOfficesView';
import { TransfersView } from '../transfers/TransfersView';
import { ReportsView } from '../reports/ReportsView';
import { AuditLogsView } from '../audit/AuditLogsView';
import { SettingsView } from '../settings/SettingsView';

export const AppLayout: React.FC = () => {
  const { activeTab, setActiveTab, activeEmployee, isOnline } = useApp();
  const role = activeEmployee?.role || 'employee';

  const [isSessionAuthenticated, setIsSessionAuthenticated] = useState<boolean>(() => {
    const activeFlag = sessionStorage.getItem('target_daily_session_active');
    const sessionDate = sessionStorage.getItem('target_session_date');
    const today = new Date().toDateString();
    return activeFlag === 'true' && sessionDate === today;
  });

  // Role Protection Guard
  useEffect(() => {
    if (role === 'viewer') {
      if (['new_service', 'treasury', 'transfers', 'settings', 'audit_logs', 'reports'].includes(activeTab)) {
        setActiveTab('operations');
      }
    } else if (role === 'employee') {
      if (['treasury', 'settings', 'audit_logs', 'reports'].includes(activeTab)) {
        setActiveTab('operations');
      }
    }
  }, [activeTab, role, setActiveTab]);

  // Keyboard shortcut listener (e.g. F1 to open new service order)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1' && role !== 'viewer') {
        e.preventDefault();
        setActiveTab('new_service');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, role]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'operations':
        return <OperationsCenter />;
      case 'new_service':
        return <NewServiceOrder />;
      case 'orders':
        return <OrdersList />;
      case 'treasury':
        return <TreasuryView />;
      case 'expenses':
        return <ExpensesView />;
      case 'distributors':
        return <DistributorsView />;
      case 'external_offices':
        return <ExternalOfficesView />;
      case 'transfers':
        return <TransfersView />;
      case 'reports':
        return <ReportsView />;
      case 'audit_logs':
        return <AuditLogsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OperationsCenter />;
    }
  };

  if (!isSessionAuthenticated) {
    return (
      <>
        <LoginScreen />
        <ToastContainer />
      </>
    );
  }

  return (
    <div id="esnad-app-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Ergonomic Global Header */}
      <Header />

      {/* Main Center Shell */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Dynamic Content Scroll Stage */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-radial from-slate-900/40 to-slate-950 relative">
          {!isOnline && (
            <div className="mb-6 bg-red-950/50 border border-red-500/50 rounded-xl p-4 flex items-start gap-3 shadow-lg shadow-red-900/20 backdrop-blur-sm animate-pulse z-50">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0 mt-0.5"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>
              <div>
                <h3 className="text-red-400 font-bold text-sm">الاتصال مقطوع (النظام متوقف)</h3>
                <p className="text-red-300/80 text-xs mt-1">عذراً، انقطع الاتصال بقاعدة البيانات. تم إيقاف تسجيل المعاملات مؤقتاً لضمان دقة وتطابق البيانات المركزية. يرجى الانتظار حتى عودة الاتصال.</p>
              </div>
            </div>
          )}
          {renderActiveView()}
        </main>
      </div>

      {/* Global Notifications Toast Container */}
      <ToastContainer />
    </div>
  );
};
