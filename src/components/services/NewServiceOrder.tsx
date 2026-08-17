/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * High-Speed Service Order Registration Component
 * Fast Tab Workflow, Dynamic Speeds & Forms, Idempotency Safeguard, Live Margin & Ledger Accounting
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDebounce } from '../../hooks/useDebounce';
import { storage } from '../../lib/storage';
import {
  User,
  Phone,
  CreditCard,
  Barcode,
  Layers,
  Zap,
  Building,
  Users2,
  Wallet,
  Smartphone,
  Save,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
  X,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ModalSelect } from '../common/ModalSelect';
import { ServiceOrder } from '../../types';
import { formatSpeedLabel } from '../../lib/formatters';

export const NewServiceOrder: React.FC = () => {
  const {
    activeBranch,
    activeEmployee,
    services,
    distributors,
    externalOffices,
    branches,
    customers,
    refreshData,
    showToast,
    generateIdempotencyKey,
    setActiveTab,
  } = useApp();

  // 1. Customer State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNationalId, setCustomerNationalId] = useState('');
  const [phoneSuggestions, setPhoneSuggestions] = useState<typeof customers>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // 2. Service & Speed State
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedSpeedCode, setSelectedSpeedCode] = useState<string>('normal');
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, any>>({});

  // 3. Form & Barcode Data
  const [formBarcode, setFormBarcode] = useState('');
  const [formSource, setFormSource] = useState<'internal' | 'external'>('internal');

  // 4. Distributor (Optional)
  const [isDistributorLinked, setIsDistributorLinked] = useState(false);
  const [selectedDistributorId, setSelectedDistributorId] = useState('');

  // 5. External Office (Optional)
  const [isExternalOfficeLinked, setIsExternalOfficeLinked] = useState(false);
  const [selectedExternalOfficeId, setSelectedExternalOfficeId] = useState('');
  const [externalOfficeCost, setExternalOfficeCost] = useState<string>('0');

  // 6. Delivery Branch
  const [deliveryBranchId, setDeliveryBranchId] = useState<string>('');

  // 7. Financial & Payment Split
  const [customPriceOverride, setCustomPriceOverride] = useState<string>('');
  const [cashAmount, setCashAmount] = useState<string>('0');
  const [electronicAmount, setElectronicAmount] = useState<string>('0');
  const [electronicType, setElectronicType] = useState<'instapay' | 'wallet' | 'pos'>('instapay');

  // 8. Notes
  const [notes, setNotes] = useState('');

  // 9. Concurrency & Protection
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [createdOrder, setCreatedOrder] = useState<ServiceOrder | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Set default service on mount
  useEffect(() => {
    if (services.length > 0 && !selectedServiceId) {
      const activeServices = services.filter(s => s.is_active);
      if (activeServices.length > 0) {
        setSelectedServiceId(activeServices[0].id);
      }
    }
  }, [services, selectedServiceId]);

  // Set default delivery branch
  useEffect(() => {
    if (activeBranch && !deliveryBranchId) {
      setDeliveryBranchId(activeBranch.id);
    }
  }, [activeBranch, deliveryBranchId]);

  // Initialize Idempotency Key
  useEffect(() => {
    setIdempotencyKey(generateIdempotencyKey('ord-submit'));
  }, [generateIdempotencyKey]);

  // Selected Service Details
  const currentService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId) || services[0] || null;
  }, [services, selectedServiceId]);

  const availableSpeeds = useMemo(() => {
    if (!currentService?.speeds) return [];
    const name = currentService.name || '';
    const isSpecial = name.includes('الرقم القومي') || name.includes('جواز سفر') || name.includes('جواز السفر') || name.includes('بطاقة');
    if (isSpecial) {
      return currentService.speeds;
    }
    return currentService.speeds.filter(s => s.code === 'normal' || s.label.includes('عادي'));
  }, [currentService]);

  // Set default speed when service changes
  useEffect(() => {
    if (availableSpeeds.length > 0) {
      const hasCurrentSpeed = availableSpeeds.some(s => s.code === selectedSpeedCode);
      if (!hasCurrentSpeed) {
        setSelectedSpeedCode(availableSpeeds[0].code);
      }
    }
  }, [availableSpeeds, selectedSpeedCode]);

  // Dynamic Price Calculation
  const calculatedServicePrice = useMemo(() => {
    if (customPriceOverride !== '' && !isNaN(Number(customPriceOverride))) {
      return Math.max(0, Number(customPriceOverride));
    }
    if (!currentService) return 0;
    const speedOpt = currentService.speeds?.find(s => s.code === selectedSpeedCode);
    const extra = speedOpt ? Number(speedOpt.extra_cost || 0) : 0;
    return Number(currentService.base_price || 0) + extra;
  }, [currentService, selectedSpeedCode, customPriceOverride]);

  // Customer Autocomplete Lookup by phone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    setCustomerPhone(val);
    if (val.length >= 3) {
      const matches = customers.filter(c => c.phone.includes(val) || c.name.includes(val));
      setPhoneSuggestions(matches.slice(0, 4));
    } else {
      setPhoneSuggestions([]);
    }
  };

  // Filtered customers for search query
  const filteredCustomersForSearch = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    const q = debouncedSearchQuery.toLowerCase().trim();
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.national_id && c.national_id.includes(q))
    ).slice(0, 5);
  }, [customers, debouncedSearchQuery]);

  const selectExistingCustomer = (cust: typeof customers[0]) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    if (cust.national_id) {
      setCustomerNationalId(cust.national_id);
    } else {
      setCustomerNationalId('');
    }
    setPhoneSuggestions([]);
    setSearchQuery('');
    setIsSearchOpen(false);
    showToast('info', 'تم استدعاء بيانات العميل', `العميل: ${cust.name}`);
  };

  // Financial Computations
  const numCash = Math.max(0, Number(cashAmount) || 0);
  const numElectronic = Math.max(0, Number(electronicAmount) || 0);
  const totalPaid = Number((numCash + numElectronic).toFixed(2));
  const remainingAmount = Number((calculatedServicePrice - totalPaid).toFixed(2));
  const numOfficeCost = isExternalOfficeLinked ? Math.max(0, Number(externalOfficeCost) || 0) : 0;
  const officeMargin = Number((calculatedServicePrice - numOfficeCost).toFixed(2));

  // Quick Payment Fillers
  const fillFullCash = () => {
    setCashAmount(calculatedServicePrice.toString());
    setElectronicAmount('0');
  };

  const fillFullElectronic = () => {
    setElectronicAmount(calculatedServicePrice.toString());
    setCashAmount('0');
  };

  // Form Reset
  const handleResetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerNationalId('');
    setFormBarcode('');
    setCustomFieldsData({});
    setIsDistributorLinked(false);
    setSelectedDistributorId('');
    setIsExternalOfficeLinked(false);
    setSelectedExternalOfficeId('');
    setExternalOfficeCost('0');
    setCustomPriceOverride('');
    setCashAmount('0');
    setElectronicAmount('0');
    setNotes('');
    setSearchQuery('');
    setIsSearchOpen(false);
    setIdempotencyKey(generateIdempotencyKey('ord-submit'));
    showToast('info', 'تمت إعادة تعيين النموذج', 'النموذج جاهز لتسجيل معاملة جديدة.');
  };

  // Submit Order with Idempotency Protection
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    // 0. Role Guard
    if (activeEmployee?.role === 'viewer') {
      showToast('error', 'صلاحية غير كافية', 'حسابك بصلاحية مشاهد فقط، لا يمكن تنفيذ أو تسجيل المعاملات.');
      return;
    }

    // 1. Core Validations
    if (!customerName.trim()) {
      showToast('error', 'حقل مطلوب ناقص', 'يرجى إدخال اسم العميل بشكل صحيح.');
      document.getElementById('order-customer-name-input')?.focus();
      return;
    }
    if (!customerPhone.trim()) {
      showToast('error', 'حقل مطلوب ناقص', 'يرجى إدخال رقم هاتف العميل.');
      document.getElementById('order-customer-phone-input')?.focus();
      return;
    }
    if (!customerNationalId.trim() || customerNationalId.trim().length !== 14) {
      showToast('error', 'الرقم القومي غير صحيح', 'يرجى إدخال الرقم القومي للعميل المكون من 14 رقماً بالكامل.');
      document.getElementById('order-customer-nid-input')?.focus();
      return;
    }
    if (!selectedServiceId) {
      showToast('error', 'اختيار الخدمة', 'يرجى اختيار الخدمة الحكومية المطلوبة.');
      return;
    }

    // Dynamic Custom Fields Validation
    if (currentService?.fields_config) {
      for (const field of currentService.fields_config) {
        if (field.required) {
          const val = customFieldsData[field.id];
          if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
            showToast('error', 'حقل خدمة مطلوب', `يرجى إكمال الحقل المطلوب للخدمة: (${field.label})`);
            const elem = document.getElementById(`custom-field-${field.id}`);
            if (elem) elem.focus();
            return;
          }
        }
      }
    }

    if (calculatedServicePrice <= 0 && customPriceOverride === '') {
      showToast('error', 'تحديد السعر', 'يرجى إدخال سعر الخدمة المتفق عليه مع العميل.');
      return;
    }
    if (totalPaid > calculatedServicePrice) {
      showToast(
        'error',
        'خطأ في التحصيل',
        `إجمالي المدفوع (${totalPaid}) لا يمكن أن يتجاوز سعر الخدمة (${calculatedServicePrice}).`
      );
      return;
    }
    if (isExternalOfficeLinked && (!selectedExternalOfficeId || numOfficeCost <= 0)) {
      showToast('error', 'المكتب الخارجي', 'يرجى تحديد المكتب الخارجي وتكلفة التنفيذ بشكل صحيح.');
      return;
    }

    try {
      setIsSubmitting(true);

      const result = storage.createServiceOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerNationalId: customerNationalId.trim() || undefined,
        serviceId: selectedServiceId,
        speedCode: selectedSpeedCode,
        formBarcode: formBarcode.trim() || undefined,
        formSource: formSource,
        customFieldsData,
        notes: notes.trim() || undefined,
        price: calculatedServicePrice,
        cashPayment: numCash,
        electronicPayment: numElectronic,
        electronicType: numElectronic > 0 ? electronicType : null,
        distributorId: isDistributorLinked ? selectedDistributorId : null,
        externalOfficeId: isExternalOfficeLinked ? selectedExternalOfficeId : null,
        externalOfficeCost: numOfficeCost,
        deliveryBranchId: deliveryBranchId || activeBranch?.id,
        idempotencyKey,
        branchId: activeBranch?.id,
        employeeId: activeEmployee?.id,
      });

      refreshData();
      setCreatedOrder(result.order);
      setIsReceiptModalOpen(true);
      showToast(
        'success',
        'تم تسجيل المعاملة بنجاح',
        `تم إصدار أمر التشغيل رقم ${result.order.order_number} بنجاح.`
      );

      // Reset form after success
      handleResetForm();
    } catch (err: any) {
      showToast('error', 'فشل تسجيل المعاملة', err.message || 'حدث خطأ أثناء معالجة الطلب.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div id="new-service-order-container" className="max-w-6xl mx-auto space-y-6">
      <form onSubmit={handleSubmitOrder} className="space-y-6">
        {/* Visual Section 1: Customer Data */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 relative">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2 shrink-0">
                <User className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-slate-100">1. بيانات العميل</h3>
              </div>

              {/* Inline Search Bar Container */}
              <div className="relative flex-1 max-w-sm">
                {isSearchOpen ? (
                  <div className="relative animate-in fade-in slide-in-from-right-3 duration-200">
                    <input
                      id="customer-search-input"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                      placeholder="ابحث بالاسم، الهاتف، أو الرقم القومي..."
                      className="w-full bg-slate-950 border border-amber-500/50 rounded-xl pr-8 pl-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none font-sans"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-400 p-0.5 rounded-md hover:bg-rose-500/10 transition-colors"
                      title="إغلاق البحث"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    {/* Absolute Dropdown Results */}
                    {searchQuery.trim() && (
                      <div className="absolute top-full mt-2 right-0 sm:right-auto sm:left-0 min-w-[280px] sm:min-w-[360px] md:min-w-[400px] z-50 divide-y divide-slate-800/80 border border-amber-500/30 rounded-xl overflow-hidden bg-slate-950 shadow-2xl max-h-60 overflow-y-auto">
                        {filteredCustomersForSearch.length > 0 ? (
                          filteredCustomersForSearch.map((cust) => (
                            <div
                              key={cust.id}
                              onClick={() => selectExistingCustomer(cust)}
                              className="p-3 text-xs hover:bg-slate-900 cursor-pointer flex items-center justify-between transition-colors group"
                            >
                              <div className="space-y-1">
                                <div className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                                  {cust.name}
                                </div>
                                <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-500" />
                                    {cust.phone}
                                  </span>
                                  {cust.national_id && (
                                    <span className="flex items-center gap-1">
                                      <CreditCard className="w-3 h-3 text-slate-500" />
                                      {cust.national_id}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {cust.total_orders && cust.total_orders > 0 ? (
                                  <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-800">
                                    {cust.total_orders} معاملات
                                  </span>
                                ) : null}
                                <span className="text-[10px] text-amber-300 bg-amber-500/10 group-hover:bg-amber-500/20 px-2 py-0.5 rounded-lg font-bold transition-colors">
                                  تعبئة
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
                            <span>لا توجد نتائج تطابق بحثك.</span>
                            <span className="text-[10px] text-slate-600">تأكد من كتابة الاسم أو الرقم بشكل صحيح.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchOpen(true);
                      setTimeout(() => {
                        document.getElementById('customer-search-input')?.focus();
                      }, 50);
                    }}
                    className="p-1 px-2.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20"
                    title="بحث عن عميل مسجل"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>بحث سريع</span>
                  </button>
                )}
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:block">Customer Information</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم العميل ثلاثي / رباعي <span className="text-rose-400">*</span>:
              </label>
              <input
                id="order-customer-name-input"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                placeholder="أدخل اسم العميل كما في المستند"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Phone with Auto-search */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رقم الهاتف <span className="text-rose-400">*</span>:
              </label>
              <div className="relative">
                <input
                  id="order-customer-phone-input"
                  type="tel"
                  required
                  dir="rtl"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  placeholder="01xxxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono text-right dir-rtl placeholder:text-right focus:border-amber-500 focus:outline-none"
                />
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              {/* Suggestions dropdown */}
              {phoneSuggestions.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800">
                  <div className="p-2 text-[10px] text-amber-400 font-bold bg-slate-950/80">
                    عملاء سابقون مسجلون بالهاتف:
                  </div>
                  {phoneSuggestions.map(cust => (
                    <div
                      key={cust.id}
                      onClick={() => selectExistingCustomer(cust)}
                      className="p-2.5 text-xs hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-200">{cust.name}</span>
                        <span className="text-slate-400 font-mono text-[11px] mr-2">({cust.phone})</span>
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        اختيار
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* National ID */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                الرقم القومي (14 رقم) <span className="text-rose-400">*</span>:
              </label>
              <div className="relative">
                <input
                  id="order-customer-nid-input"
                  type="text"
                  required
                  maxLength={14}
                  value={customerNationalId}
                  onChange={(e) => setCustomerNationalId(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                  placeholder="299xxxxxxxxxxx"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono tracking-wider focus:border-amber-500 focus:outline-none"
                />
                <CreditCard className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>

        {/* Visual Section 2: Service Selection & Dynamic Fields */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-black text-slate-100">2. تفاصيل الخدمة وسرعة التنفيذ</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Service & Execution Speed</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Service selector Modal */}
            <div>
              <ModalSelect
                id="order-service-select"
                label="نوع الخدمة الحكومية"
                required
                modalTitle="اختيار الخدمة الحكومية"
                modalSubtitle="اختر الخدمة المطلوبة لتجهيز المعاملة"
                value={selectedServiceId}
                onChange={(val) => setSelectedServiceId(val)}
                options={services
                  .filter((s) => s.is_active)
                  .map((s) => ({
                    value: s.id,
                    label: s.name,
                    icon: Layers,
                  }))}
                placeholder="انقر لاختيار الخدمة الحكومية..."
                searchable
                maxWidth="lg"
              />
            </div>

            {/* Speeds selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                سرعة التنفيذ المطلوبة <span className="text-rose-400">*</span>:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {availableSpeeds.map(speed => (
                  <button
                    key={speed.code}
                    type="button"
                    onClick={() => setSelectedSpeedCode(speed.code)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-all text-center ${
                      selectedSpeedCode === speed.code
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span>{formatSpeedLabel(speed.label || speed.code)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Section 3: Form Barcode & Source */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Barcode className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-black text-slate-100">3. بيانات الاستمارة والباركود</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Form Serial & Source</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رقم الاستمارة / Barcode:
              </label>
              <div className="relative">
                <input
                  id="order-form-barcode-input"
                  type="text"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                  placeholder="امسح الباركود بجهاز المسح أو أدخل الرقم يدوياً"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                />
                <Barcode className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">مصدر الاستمارة:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormSource('internal')}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                    formSource === 'internal'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  داخلي
                </button>
                <button
                  type="button"
                  onClick={() => setFormSource('external')}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                    formSource === 'external'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  خارجي
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Section 4: External Office & Distributor (Collapsible / Toggleable) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* External Office link */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-slate-200">إدراج مكتب خارجي للتنفيذ</h4>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isExternalOfficeLinked}
                  onChange={(e) => setIsExternalOfficeLinked(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {isExternalOfficeLinked && (
              <div className="pt-2 space-y-3 animate-in fade-in duration-200">
                <div>
                  <ModalSelect
                    label="اختر المكتب الخارجي:"
                    modalTitle="تحديد المكتب الخارجي"
                    modalSubtitle="اختر المكتب الذي سيتم إسناد المعاملة إليه"
                    value={selectedExternalOfficeId}
                    onChange={(val) => setSelectedExternalOfficeId(val)}
                    options={externalOffices
                      .filter(o => o.is_active)
                      .map(o => ({
                        value: o.id,
                        label: o.name,
                        sublabel: o.phone ? `هاتف: ${o.phone}` : undefined,
                        icon: Building,
                      }))}
                    placeholder="-- اختر المكتب --"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    تكلفة المكتب الخارجي:
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={externalOfficeCost}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                      val = val.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                      if (val.startsWith('0') && val.length > 1 && val[1] !== '.') {
                        val = val.replace(/^0+/, '');
                      }
                      if (val === '') val = '0';
                      setExternalOfficeCost(val);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Margin Preview Pill */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">هامش ربحنا الصافي:</span>
                  <span className="font-bold font-mono text-emerald-400">
                    {formatCurrency(officeMargin)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Distributor link */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users2 className="w-4 h-4 text-sky-400" />
                <h4 className="text-xs font-bold text-slate-200">ربط المعاملة بموزع</h4>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDistributorLinked}
                  onChange={(e) => setIsDistributorLinked(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            {isDistributorLinked && (
              <div className="pt-2 animate-in fade-in duration-200">
                <ModalSelect
                  label="اختر الموزع:"
                  modalTitle="تحديد الموزع"
                  modalSubtitle="اختر الموزع لربط المعاملة وقيد المستحق عليه"
                  value={selectedDistributorId}
                  onChange={(val) => setSelectedDistributorId(val)}
                  options={distributors
                    .filter(d => d.is_active)
                    .map(d => ({
                      value: d.id,
                      label: d.name,
                      badge: d.code,
                      sublabel: d.phone ? `هاتف: ${d.phone}` : undefined,
                      icon: Users2,
                    }))}
                  placeholder="-- اختر الموزع --"
                  helperText="* سيتم قيد إجمالي سعر الخدمة كدين مستحق للمكتب على الموزع."
                />
              </div>
            )}
          </div>
        </div>

        {/* Visual Section 5: Pricing, Payments Split & Live Balance (CRITICAL SECTION) */}
        <div className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black text-slate-100">4. التسعير والتحصيل المالي</h3>
            </div>
            <span className="text-xs text-amber-400/90 font-mono font-bold">Financial Accounting</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Price & Delivery Branch */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  تكلفة الخدمة <span className="text-amber-400">*</span>:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="أدخل تكلفه الخدمه"
                    value={customPriceOverride !== '' ? customPriceOverride : (calculatedServicePrice || '')}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                      val = val.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                      if (val.startsWith('0') && val.length > 1 && val[1] !== '.') {
                        val = val.replace(/^0+/, '');
                      }
                      if (val === '') val = '0';
                      setCustomPriceOverride(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold font-mono text-amber-400 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  تسعير حر ومرن - أدخل إجمالي السعر المتفق عليه مع العميل لهذه المعاملة.
                </p>
              </div>

              <div>
                <ModalSelect
                  label="فرع التسليم والاستلام المستهدف:"
                  modalTitle="تحديد فرع الاستلام"
                  modalSubtitle="اختر الفرع الذي سيستلم منه العميل المستند النهائي"
                  value={deliveryBranchId}
                  onChange={(val) => setDeliveryBranchId(val)}
                  options={branches
                    .filter(b => b.is_active)
                    .map(b => ({
                      value: b.id,
                      label: b.name,
                      badge: b.code,
                      icon: Building,
                    }))}
                  placeholder="اختر فرع الاستلام..."
                />
              </div>
            </div>

            {/* Middle Col: Payment Inputs (Cash vs Electronic) */}
            <div className="space-y-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>{isDistributorLinked ? 'المدفوع كاش (طرف الموزع كمديونية):' : 'المدفوع كاش:'}</span>
                </label>
                <button
                  type="button"
                  onClick={fillFullCash}
                  className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded hover:bg-emerald-500/30 font-bold"
                >
                  سداد كامل
                </button>
              </div>
              <input
                id="order-cash-input"
                type="text"
                inputMode="decimal"
                value={cashAmount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  let val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                  val = val.replace(/[^0-9.]/g, '');
                  const parts = val.split('.');
                  if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                  if (val.startsWith('0') && val.length > 1 && val[1] !== '.') {
                    val = val.replace(/^0+/, '');
                  }
                  if (val === '') val = '0';
                  setCashAmount(val);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
              />

              <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>المدفوع إلكتروني:</span>
                </label>
                <button
                  type="button"
                  onClick={fillFullElectronic}
                  className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded hover:bg-sky-500/30 font-bold"
                >
                  سداد كامل
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 items-center">
                <input
                  id="order-electronic-input"
                  type="text"
                  inputMode="decimal"
                  value={electronicAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
                    val = val.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    if (val.startsWith('0') && val.length > 1 && val[1] !== '.') {
                      val = val.replace(/^0+/, '');
                    }
                    if (val === '') val = '0';
                    setElectronicAmount(val);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold font-mono text-sky-400 focus:border-sky-500 focus:outline-none"
                />
                <ModalSelect
                  modalTitle="وسيلة الدفع الإلكتروني"
                  modalSubtitle="اختر نوع القناة الإلكترونية المستخدمة في التحصيل"
                  value={electronicType}
                  onChange={(val) => setElectronicType(val as any)}
                  options={[
                    { value: 'instapay', label: 'InstaPay' },
                    { value: 'wallet', label: 'محفظة إلكترونية' },
                    { value: 'pos', label: 'نقطة بيع POS' },
                  ]}
                  buttonClassName="!py-2 !bg-slate-900"
                />
              </div>
              
              {isDistributorLinked ? (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                  💡 <strong>نظام الموزعين:</strong> سيتم تسجيل المبلغ كمدفوع على المعاملة وكمديونية على الموزع، <strong>ولن يظهر في كاش الخزينة</strong> إلا عند توريده لاحقاً.
                </div>
              ) : (
                <p className="text-[10px] text-slate-500">
                  * الدفع الإلكتروني لا يُضاف إلى درج الكاش الفيزيائي.
                </p>
              )}
            </div>

            {/* Right Col: Live Remaining Calculator & Receipt Totals */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>سعر الخدمة:</span>
                  <span className="font-bold font-mono text-slate-200">
                    {formatCurrency(calculatedServicePrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>إجمالي المدفوع الآن:</span>
                  <span className="font-bold font-mono text-emerald-400">
                    {formatCurrency(totalPaid)}
                  </span>
                </div>
                <div className="h-px bg-slate-800 my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">المتبقي على العميل:</span>
                  <span
                    className={`text-lg font-black font-mono ${
                      remainingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(remainingAmount)}
                  </span>
                </div>
                {remainingAmount > 0 && (
                  <div className="text-[11px] text-rose-400/90 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                    دفعة جزئية: سيتم قيد {formatCurrency(remainingAmount)} كمبلغ متبقي يتم تحصيله لاحقاً عند الاستلام.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              ملاحظات إضافية على العملية:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
              placeholder="مثال: يرغب العميل في الاستلام من فرع مدينة نصر، تم استلام أصل المؤهل"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Submit Action Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-slate-400 font-mono">
              Idempotency Protected • Branch: {activeBranch?.code}
            </div>

            <button
              id="submit-service-order-btn"
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-black text-sm transition-all shadow-xl ${
                isSubmitting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                  <span>جاري تسجيل المعاملة بأمان...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ واصدار ايصال</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Instant Print / Confirmation Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="إيصال تسجيل المعاملة الرسمي"
        subtitle={`رقم المعاملة: ${createdOrder?.order_number}`}
        maxWidth="lg"
      >
        {createdOrder && (
          <div className="space-y-4">
            <div
              id="printable-service-receipt"
              className="p-5 bg-white text-slate-900 rounded-xl border border-slate-200 text-sm space-y-4"
            >
              <div className="text-center border-b pb-3 border-slate-200">
                <h2 className="text-lg font-black text-slate-900">تارجت للخدمات الحكومية</h2>
                <p className="text-xs text-slate-600">
                  {branches.find(b => b.id === createdOrder.creation_branch_id)?.name} - هاتف:{' '}
                  {branches.find(b => b.id === createdOrder.creation_branch_id)?.phone}
                </p>
                <div className="mt-2 font-mono font-bold text-sm bg-slate-100 inline-block px-3 py-1 rounded">
                  رقم الإيصال: {createdOrder.order_number}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">اسم العميل:</span>{' '}
                  <span className="font-bold">{createdOrder.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">رقم الهاتف:</span>{' '}
                  <span className="font-bold font-mono">{createdOrder.customer_phone}</span>
                </div>
                {createdOrder.customer_national_id && (
                  <div>
                    <span className="text-slate-500">الرقم القومي:</span>{' '}
                    <span className="font-bold font-mono">{createdOrder.customer_national_id}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">الخدمة المطلوبة:</span>{' '}
                  <span className="font-bold">{createdOrder.service_name}</span>
                </div>
                <div>
                  <span className="text-slate-500">سرعة التنفيذ:</span>{' '}
                  <span className="font-bold">{formatSpeedLabel(createdOrder.speed)}</span>
                </div>
                {createdOrder.form_barcode && (
                  <div>
                    <span className="text-slate-500">الباركود:</span>{' '}
                    <span className="font-bold font-mono">{createdOrder.form_barcode}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">تاريخ التسجيل:</span>{' '}
                  <span className="font-bold font-mono">
                    {new Date(createdOrder.created_at).toLocaleDateString('ar-EG-u-nu-latn')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">فرع التسليم:</span>{' '}
                  <span className="font-bold">
                    {branches.find(b => b.id === createdOrder.delivery_branch_id)?.name}
                  </span>
                </div>
              </div>

              <div className="border-t border-b py-3 border-slate-200 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span>إجمالي سعر الخدمة:</span>
                  <span className="font-bold">{formatCurrency(createdOrder.price)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>المبلغ المدفوع (مسدد):</span>
                  <span>{formatCurrency(createdOrder.total_paid)}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold text-sm">
                  <span>المتبقي عند الاستلام:</span>
                  <span>{formatCurrency(createdOrder.remaining)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                برجاء إحضار هذا الإيصال أو أصل البطاقة عند الاستلام.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الإيصال الفوري</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReceiptModalOpen(false);
                  setActiveTab('orders');
                }}
                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-sm"
              >
                الانتقال لسجل العمليات
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
