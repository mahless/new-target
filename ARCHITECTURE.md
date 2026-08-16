# المعمارية البرمجية | Architecture Specification

## 1. الهيكل المعماري للنظام (System Architecture)

النظام مبني وفق معمارية **Modular Clean Architecture** مع فصل تام بين طبقات العرض (UI)، المنطق التشغيلي (Business Logic)، طبقة الوصول للبيانات (Data Access)، وطبقة التخزين المالي (Financial Storage Engine).

```
┌──────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│   (React 19 + Tailwind CSS + Lucide Icons + RTL UI)           │
├──────────────────────────────────────────────────────────────┤
│                Application & State Layer                     │
│    (Context Engine + Idempotency Interceptor + Hooks)        │
├──────────────────────────────────────────────────────────────┤
│                   Business Services Layer                    │
│  - OrderService          - FinancialLedgerService            │
│  - BranchTransferService - DailyClosingService               │
│  - DistributorService    - AuditLogService                   │
├──────────────────────────────────────────────────────────────┤
│                 Data & Persistence Engine                    │
│  - Supabase PostgreSQL Client (Live Cloud Backend)           │
│  - ACID-Compliant Offline-First Local Storage Storage Fallback│
│  - Idempotency Cache & Distributed Lock Manager              │
└──────────────────────────────────────────────────────────────┘
```

## 2. مبادئ التصميم (Key Architectural Principles)

1. **مصدر الحقيقة المالي (Financial Single Source of Truth)**:
   - الرصيد الحالي للدرج لا يتم تخزينه كقيمة رقمية يتم تعديلها عشوائياً، بل يُحسب ديناميكياً أو يتم اعتماده عبر سجلات دفتر الأستاذ `cash_ledger` (Append-Only Event Ledger).
   - كل معاملة تملك أثراً مسجلاً لا يقبل الحذف.

2. **التنفيذ الذري (Atomic Transactions & RPC Operations)**:
   - التحويلات بين الفروع وتوليد أوامر الخدمة مع دفعاتها تجري داخل كتلة واحدة؛ إذا فشل أي طرف يُلغى التنفيذ كاملاً.

3. **حماية التكرار عبر مفاتيح فريدة (Idempotency Key Mechanism)**:
   - قبل إرسال أي حركة مالية يتم توليد `idempotency_key` (UUID v4 + Timestamp).
   - إذا تم تكرار الطلب، يتم التحقق من المفتاح في الخادم/المحرك وإرجاع النتيجة الأصلية دون إعادة قيد المبلغ.

4. **تتبع الأحداث الموحد (Unified Audit Trail)**:
   - كل قيد أو تعديل يحفظ: `employee_id`, `branch_id`, `action`, `old_data`, `new_data`, `timestamp`.
