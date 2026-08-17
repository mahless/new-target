/**
 * Common formatting utilities
 */

/**
 * Format numbers cleanly with thousands separators without currency suffixes (like ج.م)
 */
export const formatCurrency = (val: number): string => {
  if (isNaN(val) || val === null || val === undefined) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatNumber = (val: number): string => {
  if (isNaN(val) || val === null || val === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(val);
};

/**
 * Format service speed codes / labels into Arabic ONLY:
 * عادي | مستعجل | فوري | سوبر فوري
 */
export const formatSpeedLabel = (speed: string | undefined | null): string => {
  if (!speed) return 'عادي';
  const s = speed.trim().toLowerCase();
  if (s === 'normal' || s === 'عادي') return 'عادي';
  if (s === 'urgent' || s === 'مستعجل') return 'مستعجل';
  if (s === 'instant' || s === 'فوري') return 'فوري';
  if (s === 'super' || s === 'super_instant' || s === 'vip' || s === 'vip / سوبر' || s.includes('سوبر')) return 'سوبر فوري';
  return speed;
};

