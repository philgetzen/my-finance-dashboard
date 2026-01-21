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
  const topCategories = metrics?.topCategories || [];

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
      <note>Runway is based on net cash flow (income minus true expenses, excluding investment/savings transfers)</note>
    </cash_runway>
    <csp_buckets>
      <fixed_costs percentage="${csp.buckets?.fixedCosts?.percentage || 0}" target="50-60%" on_target="${csp.buckets?.fixedCosts?.isOnTarget}"/>
      <investments percentage="${csp.buckets?.investments?.percentage || 0}" target="10%+" on_target="${csp.buckets?.investments?.isOnTarget}"/>
      <savings percentage="${csp.buckets?.savings?.percentage || 0}" target="5-10%" on_target="${csp.buckets?.savings?.isOnTarget}"/>
      <guilt_free percentage="${csp.buckets?.guiltFree?.percentage || 0}" target="20-35%" on_target="${csp.buckets?.guiltFree?.isOnTarget}"/>
      <overall_status>${csp.isOnTrack ? 'ON TRACK' : 'NEEDS ATTENTION'}</overall_status>
    </csp_buckets>
  </current_snapshot>

  <weekly_spending note="Excludes investments and savings - shows true expenses only">
    <this_week>${formatCurrency(weekly.currentWeek?.spending || 0)}</this_week>
    <last_week>${formatCurrency(weekly.lastWeek?.spending || 0)}</last_week>
    <six_week_average>${formatCurrency(weekly.sixWeekAverage || 0)}</six_week_average>
    <vs_last_week>${weekly.change?.percent || 0}%</vs_last_week>
    <vs_average>${weekly.sixWeekAverage > 0 ? Math.round(((weekly.currentWeek?.spending || 0) - weekly.sixWeekAverage) / weekly.sixWeekAverage * 100) : 0}%</vs_average>
    <top_categories>
      ${topCategories.slice(0, 7).map(cat => `
      <category name="${cat.name}" amount="${formatCurrency(cat.amount)}" vs_average="${cat.vsAverageLabel || 'N/A'}"/>
      `).join('')}
    </top_categories>
  </weekly_spending>

  ${mom.available ? `
  <monthly_trends>
    <comparison>${mom.previousMonth?.name} to ${mom.currentMonth?.name}</comparison>
    <income_change>${mom.changes?.incomePercent || 0}%</income_change>
    <expense_change>${mom.changes?.expensesPercent || 0}%</expense_change>
    <savings_rate_change>${mom.changes?.savingsRate || 0}%</savings_rate_change>
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
    <weekly_average_true_expenses>${formatCurrency(weekly.sixWeekAverage || 0)}</weekly_average_true_expenses>
    <monthly_average_true_expenses>${formatCurrency((weekly.sixWeekAverage || 0) * 4.33)}</monthly_average_true_expenses>
    <note>True expenses exclude investments and savings contributions - these are wealth-building, not spending</note>
    <trend>${burnRate.trend || 'stable'}</trend>
    <trend_percent>${burnRate.trendPercent || 0}%</trend_percent>
  </burn_rate>

  <analysis_instructions>
    You are a knowledgeable personal finance advisor. This is a WEEKLY newsletter for a couple managing household finances.

    IMPORTANT CONTEXT:
    - Weekly spending data EXCLUDES investments and savings transfers - these are wealth-building, not expenses
    - Focus on the weekly_spending and burn_rate sections for accurate spending data
    - Cash runway uses net cash flow (income minus true expenses) - if positive, runway is infinite
    - Ignore CSP bucket percentages if they seem inconsistent - focus on actual spending categories instead

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

/**
 * Generate AI analysis using Claude
 * @param {Object} data - Financial data (metrics + trends)
 * @param {Object} options - Options (model, maxTokens)
 * @returns {Promise<Object>} - { analysis, usage, model }
 */
async function generateAnalysis(data, options = {}) {
  const {
    model = 'claude-sonnet-4-20250514',
    maxTokens = 1000,
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

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const analysis = response.content[0]?.text || '';

    logger.info('AI analysis generated', {
      model,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens
    });

    return {
      analysis,
      usage: response.usage,
      model,
      fallback: false
    };
  } catch (error) {
    logger.error('AI analysis failed', { error: error.message, model });

    // Try fallback to Haiku if Sonnet fails
    if (model !== 'claude-3-haiku-20240307' && fallbackToTemplate) {
      logger.info('Retrying with Haiku model');
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        return {
          analysis: response.content[0]?.text || '',
          usage: response.usage,
          model: 'claude-3-haiku-20240307',
          fallback: true
        };
      } catch (haikuError) {
        logger.error('Haiku fallback also failed', { error: haikuError.message });
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

    throw error;
  }
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

  // Runway insight
  if (runway.runwayHealth) {
    const runwayMonths = runway.pureRunwayMonths === Infinity ? 'unlimited' : `${Math.round(runway.pureRunwayMonths)} months`;
    if (runway.runwayHealth === 'critical') {
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
    insights.push(`Your spending trend is increasing (${burnRate.trendPercent}%). Review recent expenses to identify areas to optimize.`);
  } else if (burnRate.trend === 'decreasing') {
    insights.push(`Great job! Your spending trend is decreasing (${burnRate.trendPercent}%).`);
  }

  // Annual progress insight
  if (annual.available && annual.goals?.savingsRate) {
    if (annual.goals.savingsRate.onTrack) {
      insights.push(`You're on track with your ${annual.goals.savingsRate.actual}% savings rate, meeting your ${annual.goals.savingsRate.target}% target.`);
    } else {
      insights.push(`Your savings rate of ${annual.goals.savingsRate.actual}% is below your ${annual.goals.savingsRate.target}% target. Look for opportunities to increase savings.`);
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
