/**
 * AI Analysis Service
 * Claude API integration for financial analysis and insights
 */

const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../logger');
const { formatCurrency } = require('../newsletter/helpers');

// Initialize Anthropic client
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
}

/**
 * Build the analysis prompt from financial data
 * @param {Object} data - All financial data (metrics + trends)
 * @returns {string} - Structured prompt for Claude
 */
function buildAnalysisPrompt(data) {
  const { metrics, trends } = data;

  const netWorth = metrics?.netWorth || {};
  const runway = metrics?.runway || {};
  const csp = metrics?.csp || {};
  const burnRate = metrics?.burnRate || {};
  const weeklyTopCategories = metrics?.weeklyTopCategories || [];

  const mom = trends?.monthOverMonth || {};
  const yoy = trends?.yearOverYear || {};
  const annual = trends?.annualProgress || {};
  const weekly = trends?.weekly || {};

  return `
<financial_analysis_request>
  <current_snapshot>
    <net_worth>
      <total>${formatCurrency(netWorth.total || 0)}</total>
      <assets>${formatCurrency((netWorth.assets || 0) + (netWorth.investments || 0) + (netWorth.savings || 0))}</assets>
      <debt>${formatCurrency(netWorth.debt || 0)}</debt>
    </net_worth>
    <cash_runway>
      <realistic_months>${runway.netRunwayMonths === Infinity || runway.avgMonthlyNet >= 0 ? 'Infinite (positive cash flow)' : Math.round(runway.netRunwayMonths * 10) / 10}</realistic_months>
      <monthly_net_cash_flow>${formatCurrency(runway.avgMonthlyNet || 0)}</monthly_net_cash_flow>
      <cash_reserves>${formatCurrency(runway.cashReserves || 0)}</cash_reserves>
      <status>${runway.runwayHealth || 'unknown'}</status>
      <monthly_investing>${formatCurrency(runway.avgMonthlyInvesting || 0)}</monthly_investing>
      <note>Averages of the last ${runway.monthsAveraged || 0} complete months. Net cash flow is income minus spending. Investing is money moved into investment accounts; it is not spending.</note>
    </cash_runway>
    <csp_buckets>
      <fixed_costs percentage="${csp.buckets?.fixedCosts?.percentage || 0}" target="50-60%" on_target="${csp.buckets?.fixedCosts?.isOnTarget}"/>
      <investments percentage="${csp.buckets?.investments?.percentage || 0}" target="10%+" on_target="${csp.buckets?.investments?.isOnTarget}"/>
      <savings percentage="${csp.buckets?.savings?.percentage || 0}" target="5-10%" on_target="${csp.buckets?.savings?.isOnTarget}"/>
      <guilt_free percentage="${csp.buckets?.guiltFree?.percentage || 0}" target="20-35%" on_target="${csp.buckets?.guiltFree?.isOnTarget}"/>
      <overall_status>${csp.isOnTrack ? 'ON TRACK' : 'NEEDS ATTENTION'}</overall_status>
    </csp_buckets>
  </current_snapshot>

  <weekly_spending note="Money that left the household. Transfers between accounts and investing are excluded">
    <this_week>${formatCurrency(weekly.currentWeek?.spending || 0)}</this_week>
    <last_week>${formatCurrency(weekly.lastWeek?.spending || 0)}</last_week>
    <six_week_average>${formatCurrency(weekly.sixWeekAverage || 0)}</six_week_average>
    <vs_last_week>${weekly.change?.percent || 0}%</vs_last_week>
    <vs_average>${weekly.sixWeekAverage > 0 ? Math.round(((weekly.currentWeek?.spending || 0) - weekly.sixWeekAverage) / weekly.sixWeekAverage * 100) : 0}%</vs_average>
    <uncategorized count="${weekly.currentWeek?.uncategorized?.count || 0}" outflow="${formatCurrency(weekly.currentWeek?.uncategorized?.outflow || 0)}" note="Not yet categorized in YNAB, so not counted in this_week"/>
    <top_categories note="This week's spending by category vs 6-week weekly average">
      ${weeklyTopCategories.slice(0, 7).map(cat => `
      <category name="${cat.name}" amount="${formatCurrency(cat.amount)}" vs_weekly_average="${cat.vsAverageLabel || 'N/A'}"/>
      `).join('')}
    </top_categories>
  </weekly_spending>

  ${mom.available ? `
  <monthly_trends>
    <comparison>${mom.previousMonth?.name} to ${mom.currentMonth?.name}</comparison>
    <income_change>${mom.changes?.incomePercent || 0}%</income_change>
    <expense_change>${mom.changes?.expensesPercent || 0}%</expense_change>
    <savings_rate_change>${mom.changes?.savingsRate || 0} percentage points</savings_rate_change>
    <current_savings_rate>${mom.currentMonth?.savingsRate || 0}%</current_savings_rate>
    <top_category_changes>
      ${(mom.topCategoryChanges || []).slice(0, 5).map(cat => `
      <change category="${cat.category}" percent="${cat.changePercent}%" amount="${formatCurrency(cat.change)}"/>
      `).join('')}
    </top_category_changes>
  </monthly_trends>
  ` : '<monthly_trends available="false"/>'}

  ${yoy.available ? `
  <yearly_comparison>
    <comparison>${yoy.lastYearMonth?.name} to ${yoy.currentMonth?.name}</comparison>
    <spending_change>${yoy.spending?.changePercent || 0}%</spending_change>
    ${yoy.netWorth?.available ? `<net_worth_change>${yoy.netWorth.changePercent}%</net_worth_change>` : ''}
    <seasonal_note>${yoy.seasonalNote || 'None'}</seasonal_note>
    <category_comparison>
      ${(yoy.categoryComparison || []).slice(0, 5).map(cat => `
      <category name="${cat.category}" change="${cat.changePercent}%"/>
      `).join('')}
    </category_comparison>
  </yearly_comparison>
  ` : '<yearly_comparison available="false"/>'}

  ${annual.available ? `
  <annual_progress year="${new Date().getFullYear()}" completion="${annual.yearProgress}%">
    <ytd_savings_rate actual="${annual.ytd?.savingsRate || 0}%" target="${annual.goals?.savingsRate?.target || 25}%" on_track="${annual.goals?.savingsRate?.onTrack}"/>
    <ytd_investments actual="${formatCurrency(annual.ytd?.investments || 0)}" target="${formatCurrency(annual.goals?.investments?.target || 24000)}" progress="${annual.goals?.investments?.progress || 0}%"/>
    ${annual.netWorthProgress?.available ? `
    <ytd_net_worth_growth amount="${formatCurrency(annual.netWorthProgress.growth)}" percent="${annual.netWorthProgress.growthPercent}%"/>
    ` : ''}
    <projected_annual_savings>${formatCurrency(annual.projections?.annualSavings || 0)}</projected_annual_savings>
  </annual_progress>
  ` : '<annual_progress available="false"/>'}

  <burn_rate>
    <weekly_average_spending>${formatCurrency(weekly.sixWeekAverage || 0)}</weekly_average_spending>
    <monthly_average_spending>${formatCurrency(burnRate.average || 0)}</monthly_average_spending>
    <note>Spending excludes transfers between accounts and investment contributions - moving money into your own investments is not spending</note>
    <trend>${burnRate.trend || 'stable'}</trend>
    <trend_percent>${burnRate.trendPercent || 0}%</trend_percent>
  </burn_rate>

  <analysis_instructions>
    You are a knowledgeable personal finance advisor. This is a WEEKLY newsletter for a couple managing household finances.

    IMPORTANT CONTEXT:
    - Spending EXCLUDES transfers between accounts and investment contributions - investing is not spending
    - Uncategorized transactions are not counted; if there are any, remind them to categorize in YNAB
    - Cash runway uses net cash flow (income minus spending) - if positive, runway is infinite

    Provide a SHORT, focused analysis (150 words max) covering:

    1. **This Week**: How did spending compare to average? Any notable categories?

    2. **Cash Position**: Is runway healthy? Any concerns?

    3. **One Action**: The single most impactful thing to do this week.

    Guidelines:
    - Be conversational, not formal
    - Use the WEEKLY spending numbers, not monthly
    - If runway is infinite/positive cash flow, that's GOOD - don't alarm
    - Focus on actionable insights, not comprehensive analysis
    - Skip sections that have no meaningful insight

    Format: Use ## for section headers. Keep it brief.
  </analysis_instructions>
</financial_analysis_request>
  `.trim();
}

// Current Sonnet writes the analysis; current Haiku is the fallback
const PRIMARY_MODEL = 'claude-sonnet-5-5';
const FALLBACK_MODEL = 'claude-haiku-4-5';

/**
 * Text of a Messages API response. Sonnet 5.5 thinks before answering, so the
 * response can start with a thinking block; read text blocks by type.
 * @param {Object} response - Messages API response
 * @returns {string}
 */
function responseText(response) {
  return (response.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
}

/**
 * Ask one model for the analysis
 * @param {string} model - Model ID
 * @param {string} prompt - Analysis prompt
 * @param {number} maxTokens - Output ceiling (thinking counts toward it)
 * @returns {Promise<Object>} - { analysis, usage, model }
 */
async function requestAnalysis(model, prompt, maxTokens) {
  const isPrimary = model === PRIMARY_MODEL;

  const response = await anthropic.messages.create(
    {
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
      // Low effort keeps Sonnet's thinking short for a 150-word summary, and
      // server-side fallback retries a policy decline on another model.
      // Haiku 4.5 accepts neither setting.
      ...(isPrimary && { output_config: { effort: 'low' }, fallbacks: 'default' })
    },
    isPrimary ? { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' } } : undefined
  );

  if (response.stop_reason === 'refusal') {
    throw new Error(`${model} declined the request (${response.stop_details?.category || 'no category'})`);
  }

  const analysis = responseText(response);
  if (!analysis) {
    throw new Error(`${model} returned no text (stop_reason: ${response.stop_reason})`);
  }

  return { analysis, usage: response.usage, model: response.model || model };
}

/**
 * Generate AI analysis using Claude, falling back to Haiku and then to the template
 * @param {Object} data - Financial data (metrics + trends)
 * @param {Object} options - Options (maxTokens, fallbackToTemplate)
 * @returns {Promise<Object>} - { analysis, usage, model, fallback }
 */
async function generateAnalysis(data, options = {}) {
  const {
    maxTokens = 16000,
    fallbackToTemplate = true
  } = options;

  // Check if API is configured
  if (!anthropic) {
    if (fallbackToTemplate) {
      logger.warn('Anthropic API not configured, using template fallback');
      return {
        analysis: generateTemplateAnalysis(data),
        usage: null,
        model: 'template-fallback',
        fallback: true
      };
    }
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const prompt = buildAnalysisPrompt(data);
  let lastError;

  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const result = await requestAnalysis(model, prompt, maxTokens);

      logger.info('AI analysis generated', {
        model: result.model,
        inputTokens: result.usage?.input_tokens,
        outputTokens: result.usage?.output_tokens
      });

      return { ...result, fallback: result.model !== PRIMARY_MODEL };
    } catch (error) {
      lastError = error;
      logger.error('AI analysis failed', { model, error: error.message });
    }
  }

  // Final fallback to template
  if (fallbackToTemplate) {
    return {
      analysis: generateTemplateAnalysis(data),
      usage: null,
      model: 'template-fallback',
      fallback: true
    };
  }

  throw lastError;
}

/**
 * Generate template-based analysis (fallback when AI unavailable)
 * @param {Object} data - Financial data
 * @returns {string} - Template-based analysis
 */
function generateTemplateAnalysis(data) {
  const { metrics, trends } = data;
  const csp = metrics?.csp || {};
  const runway = metrics?.runway || {};
  const burnRate = metrics?.burnRate || {};
  const annual = trends?.annualProgress || {};

  const insights = [];

  // Net Worth insight
  if (metrics?.netWorth?.total) {
    insights.push(`Your current net worth is ${formatCurrency(metrics.netWorth.total)}.`);
  }

  // Runway insight (same figure the newsletter shows: runway after income)
  if (runway.runwayHealth) {
    const months = runway.netRunwayMonths;
    const runwayMonths = !isFinite(months) ? 'unlimited' : `${Math.round(months * 10) / 10} months`;
    if (!isFinite(months)) {
      insights.push('Income covers your spending, so your cash reserves are growing.');
    } else if (runway.runwayHealth === 'critical') {
      insights.push(`Your cash runway of ${runwayMonths} is below the recommended 3-month minimum. Consider building up your emergency fund.`);
    } else if (runway.runwayHealth === 'caution') {
      insights.push(`Your ${runwayMonths} cash runway is adequate but could be stronger. The recommended target is 6+ months.`);
    } else {
      insights.push(`Your ${runwayMonths} cash runway provides solid financial security.`);
    }
  }

  // CSP insight
  if (!csp.isOnTrack && csp.suggestions?.length) {
    insights.push(csp.suggestions[0].message);
  } else if (csp.isOnTrack) {
    insights.push('Your Conscious Spending Plan is on track. Keep up the good work!');
  }

  // Burn rate insight
  if (burnRate.trend === 'increasing') {
    insights.push(`Spending over the last 3 full months is up ${burnRate.trendPercent}% from the 3 before. Review recent expenses to identify areas to optimize.`);
  } else if (burnRate.trend === 'decreasing') {
    insights.push(`Great job! Spending over the last 3 full months is down ${Math.abs(burnRate.trendPercent)}% from the 3 before.`);
  }

  // Annual progress insight
  if (annual.available && annual.goals?.savingsRate) {
    if (annual.goals.savingsRate.onTrack) {
      insights.push(`Your year-to-date savings rate of ${annual.goals.savingsRate.actual}% meets your ${annual.goals.savingsRate.target}% target.`);
    } else {
      insights.push(`Your year-to-date savings rate of ${annual.goals.savingsRate.actual}% is below your ${annual.goals.savingsRate.target}% target. Look for opportunities to increase savings.`);
    }
  }

  return insights.join('\n\n') || 'Financial data analysis is currently limited. Check back next week for more insights.';
}

/**
 * Get the analysis prompt without calling the API (for preview)
 * @param {Object} data - Financial data
 * @returns {Object} - { prompt, estimatedTokens }
 */
function getAnalysisPrompt(data) {
  const prompt = buildAnalysisPrompt(data);
  const estimatedTokens = Math.ceil(prompt.length / 4);

  return {
    prompt,
    estimatedTokens
  };
}

/**
 * Validate AI service configuration
 * @returns {Object} - Configuration status
 */
function validateConfig() {
  return {
    configured: !!process.env.ANTHROPIC_API_KEY,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY
  };
}

module.exports = {
  generateAnalysis,
  buildAnalysisPrompt,
  getAnalysisPrompt,
  generateTemplateAnalysis,
  validateConfig
};
