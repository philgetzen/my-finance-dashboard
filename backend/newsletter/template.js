/**
 * Newsletter Email Template
 * Focused 4-section layout: Weekly Burn Rate, Runway, Categories with Alerts, AI Insights
 */

const { formatCurrency, formatDateShort } = require('./helpers');

/**
 * Convert basic markdown to HTML for email
 * @param {string} text - Text with markdown
 * @returns {string} - HTML string
 */
function markdownToHtml(text) {
  if (!text) return '';

  let result = text
    // Headers: ## Header -> <strong>Header</strong>
    .replace(/^##\s+(.+)$/gm, '</p><p style="margin: 12px 0;"><strong style="color: #1a1a1a;">$1</strong><br>')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>');

  // Handle numbered lists: group consecutive numbered items
  result = result.replace(/(?:^\d+\.\s+.+$\n?)+/gm, (match) => {
    const items = match.trim().split('\n')
      .map(line => line.replace(/^\d+\.\s+(.+)$/, '<li style="margin: 4px 0;">$1</li>'))
      .join('');
    return `<ul style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">${items}</ul>`;
  });

  // Handle bullet lists: group consecutive bullet items
  result = result.replace(/(?:^[-*]\s+.+$\n?)+/gm, (match) => {
    const items = match.trim().split('\n')
      .map(line => line.replace(/^[-*]\s+(.+)$/, '<li style="margin: 4px 0;">$1</li>'))
      .join('');
    return `<ul style="margin: 8px 0; padding-left: 20px; list-style-type: disc;">${items}</ul>`;
  });

  // Line breaks
  result = result
    .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
    .replace(/\n/g, '<br>');

  // Clean up empty paragraphs
  result = result.replace(/<p style="margin: 12px 0;"><\/p>/g, '');

  return result;
}

/**
 * Get week date range string
 * @param {Date} weekEnd - End date of the week
 * @returns {string} - Formatted date range like "Jan 15 - Jan 21"
 */
function getWeekDateRange() {
  const now = new Date();
  // Get start of current week (Sunday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Week end is Saturday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return `${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)}`;
}

/**
 * Get health status indicator
 * @param {string} status - 'excellent', 'healthy', 'caution', 'critical'
 * @returns {Object} - { emoji, color, label, bgColor }
 */
function getHealthIndicator(status) {
  const indicators = {
    excellent: { emoji: '&#10003;', color: '#10B981', label: 'EXCELLENT', bgColor: '#D1FAE5' },
    healthy: { emoji: '&#10003;', color: '#3B82F6', label: 'HEALTHY', bgColor: '#DBEAFE' },
    caution: { emoji: '&#9888;', color: '#F59E0B', label: 'CAUTION', bgColor: '#FEF3C7' },
    critical: { emoji: '&#10007;', color: '#EF4444', label: 'CRITICAL', bgColor: '#FEE2E2' }
  };
  return indicators[status] || indicators.caution;
}

/**
 * Get burn rate status based on spending vs average
 * @param {number} currentSpending - This week's spending
 * @param {number} averageWeekly - Average weekly spending
 * @returns {Object} - { color, bgColor, label }
 */
function getBurnRateStatus(currentSpending, averageWeekly) {
  if (averageWeekly === 0) {
    return { color: '#6B7280', bgColor: '#F3F4F6', label: 'NO DATA' };
  }

  const percentOver = ((currentSpending - averageWeekly) / averageWeekly) * 100;

  if (percentOver <= 0) {
    return { color: '#10B981', bgColor: '#D1FAE5', label: 'UNDER BUDGET' };
  } else if (percentOver <= 20) {
    return { color: '#F59E0B', bgColor: '#FEF3C7', label: 'SLIGHTLY OVER' };
  } else {
    return { color: '#EF4444', bgColor: '#FEE2E2', label: 'OVER BUDGET' };
  }
}

/**
 * Format runway months for display
 * @param {number} months - Number of months
 * @returns {string} - Formatted display
 */
function formatRunwayMonths(months) {
  if (months === Infinity || months > 999) {
    return '∞';
  }
  return Math.round(months * 10) / 10;
}

/**
 * Generate the full newsletter HTML - Focused 4-section layout
 * @param {Object} data - All newsletter data
 * @returns {string} - Complete HTML email
 */
function generateNewsletterHtml(data) {
  const {
    metrics,
    trends,
    aiAnalysis,
    weekEnding
  } = data;

  const runway = metrics?.runway || {};
  const topCategories = metrics?.topCategories || [];
  const weekly = trends?.weekly || {};

  // Use 6-week average of true expenses (excludes investments/savings)
  const weeklyAverage = weekly.sixWeekAverage || 0;

  // Current week spending
  const currentWeekSpending = weekly.currentWeek?.spending || 0;
  const lastWeekSpending = weekly.lastWeek?.spending || 0;
  const weekChange = weekly.change || { amount: 0, percent: 0 };

  // Burn rate status
  const burnStatus = getBurnRateStatus(currentWeekSpending, weeklyAverage);

  // Runway health
  const runwayHealth = getHealthIndicator(runway.runwayHealth || 'caution');

  // Categories with alerts (>20% over average)
  const categoriesWithAlerts = topCategories.slice(0, 7).map(cat => ({
    ...cat,
    isAlert: cat.vsAverage > 20
  }));

  const alertedCategories = categoriesWithAlerts.filter(c => c.isAlert);
  const hasAlerts = alertedCategories.length > 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Financial Update</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .section {
      padding: 24px 20px;
      border-bottom: 1px solid #e5e5e5;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #6366F1;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 16px;
    }
    .hero-number {
      font-size: 48px;
      font-weight: 700;
      color: #1a1a1a;
      line-height: 1;
    }
    .hero-context {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .comparison-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .comparison-label {
      color: #666;
    }
    .comparison-value {
      font-weight: 500;
    }
    .category-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #f5f5f5;
    }
    .category-item:last-child {
      border-bottom: none;
    }
    .category-name {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .alert-icon {
      color: #EF4444;
      font-size: 14px;
    }
    .category-amount {
      text-align: right;
    }
    .category-amount-value {
      font-weight: 600;
    }
    .category-vs-avg {
      font-size: 12px;
      margin-left: 8px;
    }
    .all-clear {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background-color: #D1FAE5;
      border-radius: 8px;
      color: #065F46;
      font-size: 14px;
    }
    .ai-section {
      background-color: #faf5ff;
      border-left: 4px solid #8B5CF6;
      padding: 20px;
      margin: 20px;
      border-radius: 0 8px 8px 0;
    }
    .ai-header {
      font-size: 14px;
      font-weight: 600;
      color: #8B5CF6;
      margin-bottom: 12px;
    }
    .ai-content {
      font-size: 14px;
      line-height: 1.7;
    }
    .ai-content strong {
      font-weight: 600;
      color: #1a1a1a;
    }
    .ai-content ul {
      margin: 8px 0;
      padding-left: 20px;
    }
    .ai-content li {
      margin: 4px 0;
    }
    .ai-fallback {
      font-style: italic;
      color: #666;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .runway-display {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-top: 16px;
    }
    .runway-number {
      font-size: 36px;
      font-weight: 700;
    }
    .runway-unit {
      font-size: 16px;
      color: #666;
    }
    .runway-context {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
      }
      .hero-number {
        font-size: 40px;
      }
      .runway-number {
        font-size: 32px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>Weekly Financial Update</h1>
      <p>Week ending ${weekEnding}</p>
    </div>

    <!-- Section 1: Weekly Burn Rate (Hero) -->
    <div class="section">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="section-title" style="margin: 0;">This Week's Spending</div>
          <div style="font-size: 12px; color: #888; margin-top: 4px;">${getWeekDateRange()}</div>
        </div>
        <span class="status-badge" style="background-color: ${burnStatus.bgColor}; color: ${burnStatus.color};">
          ${burnStatus.label}
        </span>
      </div>

      ${currentWeekSpending === 0 ? `
        <div style="margin-top: 16px;">
          <div class="hero-number" style="color: #6B7280;">$0</div>
          <div class="hero-context">No spending recorded this week</div>
        </div>
      ` : `
        <div style="margin-top: 16px;">
          <div class="hero-number">${formatCurrency(currentWeekSpending)}</div>
          <div class="hero-context">
            ${weeklyAverage > 0 ? `
              ${currentWeekSpending <= weeklyAverage ?
                `${formatCurrency(weeklyAverage - currentWeekSpending)} under your weekly average` :
                `${formatCurrency(currentWeekSpending - weeklyAverage)} over your weekly average`
              }
            ` : ''}
          </div>
        </div>

        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #f0f0f0;">
          ${lastWeekSpending > 0 ? `
            <div class="comparison-row">
              <span class="comparison-label">vs Last Week</span>
              <span class="comparison-value" style="color: ${weekChange.amount <= 0 ? '#10B981' : '#EF4444'};">
                ${weekChange.amount <= 0 ? '' : '+'}${formatCurrency(weekChange.amount)} (${weekChange.percent >= 0 ? '+' : ''}${weekChange.percent}%)
              </span>
            </div>
          ` : ''}
          ${weeklyAverage > 0 ? `
            <div class="comparison-row">
              <span class="comparison-label">Weekly Average</span>
              <span class="comparison-value">${formatCurrency(weeklyAverage)}</span>
            </div>
          ` : ''}
        </div>
      `}
    </div>

    <!-- Section 2: Runway Context -->
    <div class="section">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div class="section-title" style="margin: 0;">Cash Runway</div>
        <span class="status-badge" style="background-color: ${runwayHealth.bgColor}; color: ${runwayHealth.color};">
          ${runwayHealth.label}
        </span>
      </div>

      <div class="runway-display">
        <span class="runway-number">${formatRunwayMonths(runway.netRunwayMonths || runway.pureRunwayMonths || 0)}</span>
        <span class="runway-unit">months</span>
      </div>

      <div class="runway-context">
        ${(runway.netRunwayMonths === Infinity || runway.netRunwayMonths > 999) ?
          `Your income exceeds expenses - unlimited runway!` :
          runway.avgMonthlyNet >= 0 ?
            `With your positive cash flow, your ${formatCurrency(runway.cashReserves || 0)} in reserves continues to grow` :
            `Based on your net monthly spend, your ${formatCurrency(runway.cashReserves || 0)} in cash covers ${formatRunwayMonths(runway.netRunwayMonths || 0)} months`
        }
      </div>

      ${runway.avgMonthlyExpenses > 0 ? `
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
          <div class="comparison-row">
            <span class="comparison-label">Monthly Net Cash Flow</span>
            <span class="comparison-value" style="color: ${(runway.avgMonthlyNet || 0) >= 0 ? '#10B981' : '#EF4444'};">
              ${(runway.avgMonthlyNet || 0) >= 0 ? '+' : ''}${formatCurrency(runway.avgMonthlyNet || 0)}
            </span>
          </div>
          <div class="comparison-row">
            <span class="comparison-label">Cash Reserves</span>
            <span class="comparison-value">${formatCurrency(runway.cashReserves || 0)}</span>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Section 3: Top Categories with Alerts -->
    <div class="section">
      <div class="section-title">Spending by Category</div>

      ${hasAlerts ? `
        <div style="margin-bottom: 16px; padding: 12px 16px; background-color: #FEF3C7; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="color: #F59E0B;">&#9888;</span>
          <span style="font-size: 13px; color: #92400E;">
            ${alertedCategories.length} ${alertedCategories.length === 1 ? 'category' : 'categories'} significantly above average
          </span>
        </div>
      ` : `
        <div class="all-clear">
          <span>&#10003;</span>
          <span>All categories within normal range</span>
        </div>
      `}

      <div style="margin-top: 16px;">
        ${categoriesWithAlerts.length > 0 ? categoriesWithAlerts.map(cat => `
          <div class="category-item">
            <div class="category-name">
              ${cat.isAlert ? '<span class="alert-icon">&#9650;</span>' : ''}
              <span>${cat.name}</span>
            </div>
            <div class="category-amount">
              <span class="category-amount-value">${formatCurrency(cat.amount)}</span>
              ${cat.vsAverage !== 0 ? `
                <span class="category-vs-avg" style="color: ${cat.vsAverage > 20 ? '#EF4444' : cat.vsAverage > 0 ? '#F59E0B' : '#10B981'};">
                  ${cat.vsAverageLabel} vs avg
                </span>
              ` : ''}
            </div>
          </div>
        `).join('') : `
          <div style="color: #666; font-style: italic; padding: 16px 0;">
            No spending categories recorded this month
          </div>
        `}
      </div>
    </div>

    <!-- Section 4: AI Insights -->
    <div class="ai-section">
      <div class="ai-header">
        &#129302; Weekly Insights
      </div>
      <div class="ai-content">
        ${aiAnalysis ? `<p style="margin: 0;">${markdownToHtml(aiAnalysis)}</p>` : `
          <span class="ai-fallback">
            Your finances are looking steady this week. Keep monitoring your spending to stay on track with your goals.
          </span>
        `}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>This newsletter was automatically generated by your Finance Dashboard.</p>
      <p style="margin-top: 10px;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color: #6366F1; text-decoration: none;">View Full Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate subject line for newsletter
 * @param {Object} data - Newsletter data
 * @returns {string} - Email subject
 */
function generateSubject(data) {
  const weekEnding = data.weekEnding || new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Include spending status in subject for quick glance
  const weekly = data.trends?.weekly || {};
  const currentSpending = weekly.currentWeek?.spending || 0;
  const weeklyAverage = weekly.sixWeekAverage || 0;

  let statusEmoji = '📊';
  if (currentSpending > 0 && weeklyAverage > 0) {
    const percentOver = ((currentSpending - weeklyAverage) / weeklyAverage) * 100;
    if (percentOver <= 0) {
      statusEmoji = '✅';
    } else if (percentOver <= 20) {
      statusEmoji = '⚡';
    } else {
      statusEmoji = '🔺';
    }
  }

  return `${statusEmoji} Weekly Update - ${weekEnding}`;
}

/**
 * Format change with arrow (for backwards compatibility)
 * @param {number} change - Change amount
 * @param {number} percent - Change percentage
 * @param {boolean} positiveIsGood - Whether positive is good
 * @returns {string} - Formatted change string
 */
function formatChange(change, percent, positiveIsGood = true) {
  const isPositive = change > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const color = isGood ? '#10B981' : '#EF4444';
  const arrow = isPositive ? '&#9650;' : '&#9660;';
  const sign = change >= 0 ? '+' : '';
  return `<span style="color: ${color};">${arrow}</span> ${sign}${formatCurrency(change)} (${sign}${percent}%)`;
}

module.exports = {
  generateNewsletterHtml,
  generateSubject,
  getHealthIndicator,
  formatChange
};
