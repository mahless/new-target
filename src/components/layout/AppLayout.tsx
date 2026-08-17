/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Ergonomic Enterprise AppLayout with Dynamic View Routing
 */

import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { Sidebar } from '../common/Sidebar';
import { ToastContainer } from '../common/ToastContainer';
import { OperationsCenter } from '../operations/OperationsCenter';
import { NewServiceOrder } from '../services/NewServiceOrder';
import { OrdersList } from '../orders/OrdersList';
import { TreasuryView } from '../treasury/TreasuryView';
import { ExpensesView } from '../expenses/ExpensesView';
import { DistributorsView } from '../distributors/DistributorsView';
import { ExternalOfficesView } from '../offices/ExternalOfficesView';
import { TransfersView } from '../transfers/TransfersView';
import { DailyClosingView } from '../closing/DailyClosingView';
import { ReportsView } from '../reports/ReportsView';
import { AuditLogsView } from '../audit/AuditLogsView';
import { SettingsView } from '../settings/SettingsView';

export const AppLayout: React.FC = () => {
  const { activeTab, setActiveTab, activeEmployee } = useApp();
  const role = activeEmployee?.role || 'employee';

  // Role Protection Guard
  useEffect(() => {
    if (role === 'viewer') {
      if (['new_service', 'transfers', 'daily_closing', 'settings', 'audit_logs'].includes(activeTab)) {
        setActiveTab('operations');
      }
    } else if (role === 'employee') {
      if (['settings', 'audit_logs'].includes(activeTab)) {
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
      case 'daily_closing':
        return <DailyClosingView />;
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

  return (
    <div id="esnad-app-root" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Ergonomic Global Header */}
      <Header />

      {/* Main Center Shell */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Dynamic Content Scroll Stage */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-radial from-slate-900/40 to-slate-950">
          {renderActiveView()}
        </main>
      </div>

      {/* Global Notifications Toast Container */}
      <ToastContainer />
    </div>
  );
};
