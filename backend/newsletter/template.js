/**
 * Newsletter Email Template
 * Focused 4-section layout: Weekly Burn Rate, Runway, Categories with Alerts, AI Insights
 * Uses table-based layout with inline styles for Gmail compatibility
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
 * Uses table-based layout with inline styles for Gmail compatibility
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
  const weeklyTopCategories = metrics?.weeklyTopCategories || [];
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

  // Categories with alerts (>20% over weekly average)
  const categoriesWithAlerts = weeklyTopCategories.slice(0, 7).map(cat => ({
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
  <!--[if mso]>
  <style>table { border-collapse: collapse; } td { font-family: Arial, sans-serif; }</style>
  <![endif]-->
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; background-color: #f5f5f5; margin: 0; padding: 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: white; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: white;">Weekly Financial Update</h1>
              <p style="margin: 10px 0 0; opacity: 0.9; font-size: 14px; color: white;">Week ending ${weekEnding}</p>
            </td>
          </tr>

          <!-- Section 1: Weekly Burn Rate (Hero) -->
          <tr>
            <td style="padding: 24px 20px; border-bottom: 1px solid #e5e5e5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: top;">
                    <div style="font-size: 13px; font-weight: 600; color: #6366F1; text-transform: uppercase; letter-spacing: 1px; margin: 0;">This Week's Spending</div>
                    <div style="font-size: 12px; color: #888; margin-top: 4px;">${getWeekDateRange()}</div>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; background-color: ${burnStatus.bgColor}; color: ${burnStatus.color};">
                      ${burnStatus.label}
                    </span>
                  </td>
                </tr>
              </table>

              ${currentWeekSpending === 0 ? `
                <div style="margin-top: 16px;">
                  <div style="font-size: 48px; font-weight: 700; color: #6B7280; line-height: 1;">$0</div>
                  <div style="font-size: 14px; color: #666; margin-top: 8px;">No spending recorded this week</div>
                </div>
              ` : `
                <div style="margin-top: 16px;">
                  <div style="font-size: 48px; font-weight: 700; color: #1a1a1a; line-height: 1;">${formatCurrency(currentWeekSpending)}</div>
                  <div style="font-size: 14px; color: #666; margin-top: 8px;">
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
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666;">vs Last Week</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 500; color: ${weekChange.amount <= 0 ? '#10B981' : '#EF4444'};">
                          ${weekChange.amount <= 0 ? '' : '+'}${formatCurrency(weekChange.amount)} (${weekChange.percent >= 0 ? '+' : ''}${weekChange.percent}%)
                        </td>
                      </tr>
                    </table>
                  ` : ''}
                  ${weeklyAverage > 0 ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; color: #666;">Weekly Average</td>
                        <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 500;">${formatCurrency(weeklyAverage)}</td>
                      </tr>
                    </table>
                  ` : ''}
                </div>
              `}
            </td>
          </tr>

          <!-- Section 2: Runway Context -->
          <tr>
            <td style="padding: 24px 20px; border-bottom: 1px solid #e5e5e5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: top;">
                    <div style="font-size: 13px; font-weight: 600; color: #6366F1; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Cash Runway</div>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; background-color: ${runwayHealth.bgColor}; color: ${runwayHealth.color};">
                      ${runwayHealth.label}
                    </span>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 16px;">
                <span style="font-size: 36px; font-weight: 700;">${formatRunwayMonths(runway.netRunwayMonths || runway.pureRunwayMonths || 0)}</span>
                <span style="font-size: 16px; color: #666; margin-left: 8px;">months</span>
              </div>

              <div style="font-size: 14px; color: #666; margin-top: 8px;">
                ${(runway.netRunwayMonths === Infinity || runway.netRunwayMonths > 999) ?
                  `Your income exceeds expenses - unlimited runway!` :
                  runway.avgMonthlyNet >= 0 ?
                    `With your positive cash flow, your ${formatCurrency(runway.cashReserves || 0)} in reserves continues to grow` :
                    `Based on your net monthly spend, your ${formatCurrency(runway.cashReserves || 0)} in cash covers ${formatRunwayMonths(runway.netRunwayMonths || 0)} months`
                }
              </div>

              ${runway.avgMonthlyExpenses > 0 ? `
                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 8px 0; font-size: 14px; color: #666;">Monthly Net Cash Flow</td>
                      <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 500; color: ${(runway.avgMonthlyNet || 0) >= 0 ? '#10B981' : '#EF4444'};">
                        ${(runway.avgMonthlyNet || 0) >= 0 ? '+' : ''}${formatCurrency(runway.avgMonthlyNet || 0)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-size: 14px; color: #666;">Cash Reserves</td>
                      <td align="right" style="padding: 8px 0; font-size: 14px; font-weight: 500;">${formatCurrency(runway.cashReserves || 0)}</td>
                    </tr>
                  </table>
                </div>
              ` : ''}
            </td>
          </tr>

          <!-- Section 3: Top Categories with Alerts -->
          <tr>
            <td style="padding: 24px 20px; border-bottom: 1px solid #e5e5e5;">
              <div style="font-size: 13px; font-weight: 600; color: #6366F1; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">Spending by Category</div>

              ${hasAlerts ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                  <tr>
                    <td style="padding: 12px 16px; background-color: #FEF3C7; border-radius: 8px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="color: #F59E0B; font-size: 14px; padding-right: 8px; vertical-align: middle;">&#9888;</td>
                          <td style="font-size: 13px; color: #92400E; vertical-align: middle;">
                            ${alertedCategories.length} ${alertedCategories.length === 1 ? 'category' : 'categories'} significantly above average
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              ` : `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                  <tr>
                    <td style="padding: 12px 16px; background-color: #D1FAE5; border-radius: 8px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="color: #065F46; font-size: 14px; padding-right: 8px; vertical-align: middle;">&#10003;</td>
                          <td style="font-size: 14px; color: #065F46; vertical-align: middle;">All categories within normal range</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              `}

              <div style="margin-top: 16px;">
                ${categoriesWithAlerts.length > 0 ? categoriesWithAlerts.map(cat => `
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #f5f5f5;">
                    <tr>
                      <td style="padding: 10px 0; font-size: 14px; vertical-align: middle;">
                        ${cat.isAlert ? '<span style="color: #EF4444; font-size: 14px; margin-right: 8px;">&#9650;</span>' : ''}
                        <span>${cat.name}</span>
                      </td>
                      <td align="right" style="padding: 10px 0; vertical-align: middle; white-space: nowrap;">
                        <span style="font-weight: 600; font-size: 14px;">${formatCurrency(cat.amount)}</span>
                        ${cat.vsAverage !== 0 ? `
                          <span style="font-size: 12px; margin-left: 8px; color: ${cat.vsAverage > 20 ? '#EF4444' : cat.vsAverage > 0 ? '#F59E0B' : '#10B981'};">
                            ${cat.vsAverageLabel} vs avg
                          </span>
                        ` : ''}
                      </td>
                    </tr>
                  </table>
                `).join('') : `
                  <div style="color: #666; font-style: italic; padding: 16px 0;">
                    No spending categories recorded this month
                  </div>
                `}
              </div>
            </td>
          </tr>

          <!-- Section 4: AI Insights -->
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color: #faf5ff; border-left: 4px solid #8B5CF6; padding: 20px; border-radius: 0 8px 8px 0;">
                    <div style="font-size: 14px; font-weight: 600; color: #8B5CF6; margin-bottom: 12px;">
                      &#129302; Weekly Insights
                    </div>
                    <div style="font-size: 14px; line-height: 1.7; color: #1a1a1a;">
                      ${aiAnalysis ? `<p style="margin: 0;">${markdownToHtml(aiAnalysis)}</p>` : `
                        <span style="font-style: italic; color: #666;">
                          Your finances are looking steady this week. Keep monitoring your spending to stay on track with your goals.
                        </span>
                      `}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">This newsletter was automatically generated by your Finance Dashboard.</p>
              <p style="margin: 10px 0 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color: #6366F1; text-decoration: none;">View Full Dashboard</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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
