/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Ergonomic Navigation Sidebar
 */

import React from 'react';
import { useApp, NavigationTab } from '../../context/AppContext';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  Wallet,
  Receipt,
  Users2,
  Building,
  ArrowLeftRight,
  Lock,
  BarChart3,
  ShieldAlert,
  Settings,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  highlight?: boolean;
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, stats, isSidebarOpen, setIsSidebarOpen, activeEmployee } = useApp();
  const role = activeEmployee?.role || 'employee';

  const handleSelectTab = (tabId: NavigationTab) => {
    setActiveTab(tabId);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const navItems: NavItem[] = [
    {
      id: 'operations',
      label: 'الرئيسية',
      icon: LayoutDashboard,
    },
    {
      id: 'new_service',
      label: 'خدمة جديدة',
      icon: PlusCircle,
      highlight: true,
    },
    {
      id: 'orders',
      label: 'سجل العمليات',
      icon: FileText,
      badge: stats.activeOrdersCount,
    },
    {
      id: 'treasury',
      label: 'الخزنة',
      icon: Wallet,
    },
    {
      id: 'expenses',
      label: 'المصروفات',
      icon: Receipt,
    },
    {
      id: 'distributors',
      label: 'الموزعين',
      icon: Users2,
    },
    {
      id: 'external_offices',
      label: 'المكاتب الخارجية',
      icon: Building,
    },
    {
      id: 'transfers',
      label: 'التحويل بين الفروع',
      icon: ArrowLeftRight,
    },
    {
      id: 'daily_closing',
      label: 'الإغلاق والتسوية اليومية',
      icon: Lock,
    },
    {
      id: 'reports',
      label: 'التقارير',
      icon: BarChart3,
    },
    {
      id: 'audit_logs',
      label: 'سجل الرقابة والتتبع',
      icon: ShieldAlert,
    },
    {
      id: 'settings',
      label: 'الاعدادات',
      icon: Settings,
    },
  ];

  const allowedItems = navItems.filter(item => {
    if (role === 'viewer') {
      return !['new_service', 'transfers', 'daily_closing', 'settings', 'audit_logs'].includes(item.id);
    }
    if (role === 'employee') {
      return !['settings', 'audit_logs'].includes(item.id);
    }
    return true; // manager sees everything
  });

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          id="mobile-sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        id="app-sidebar"
        className={`fixed md:static inset-y-0 right-0 z-50 md:z-auto w-72 md:w-64 border-l border-slate-800 bg-slate-900 md:bg-slate-900/60 backdrop-blur-xl flex flex-col justify-between shrink-0 select-none py-4 px-3 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-8rem)] md:max-h-none">
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center justify-between">
            <span>القائمة الرئيسية</span>
            <span className="md:hidden text-amber-400 text-xs font-mono font-normal">تارجت للخدمات</span>
          </div>
          {allowedItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (item.highlight) {
              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-${item.id}`}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all my-1.5 ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-slate-800 text-amber-400 font-bold border-r-2 border-amber-400 shadow-sm'
                    : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer info pill */}
        <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl mt-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>حالة التشغيل</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              نشط ومؤمّن
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
