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
