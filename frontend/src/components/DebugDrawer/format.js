// Shared by the debug views. Kept out of DebugDrawer.jsx so that file only
// exports components (React fast refresh).

/**
 * Format currency for display
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Check if two amounts match within tolerance
 */
export function amountsMatch(a, b, tolerance = 0.01) {
  return Math.abs((a || 0) - (b || 0)) <= tolerance;
}
