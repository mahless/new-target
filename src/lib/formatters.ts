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

const SPEED_MAP: Record<string, string> = {
  normal: 'عادي',
  standard: 'عادي',
  urgent: 'مستعجل',
  fast: 'سريع',
  express: 'سريع جداً',
  instant: 'فوري',
  vip: 'VIP / فوري',
};

export const formatSpeedLabel = (speed?: string | null): string => {
  if (!speed) return 'عادي';
  const lower = speed.toLowerCase().trim();
  if (SPEED_MAP[lower]) return SPEED_MAP[lower];
  return speed;
};
