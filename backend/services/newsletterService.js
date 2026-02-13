/**
 * Newsletter Service
 * Main orchestration for newsletter generation and delivery
 */

const axios = require('axios');
const admin = require('firebase-admin');
const logger = require('../logger');
const { calculateAllMetrics } = require('../newsletter/metrics');
const { calculateAllTrends } = require('../newsletter/trends');
const { generateNewsletterHtml, generateSubject } = require('../newsletter/template');
const { sendNewsletter, getRecipients, validateConfig: validateEmailConfig } = require('./emailService');
const { generateAnalysis, validateConfig: validateAiConfig, getAnalysisPrompt } = require('./aiAnalysisService');
const { formatDate, getNextSaturday9am } = require('../newsletter/helpers');

// YNAB API configuration
const YNAB_API_BASE_URL = 'https://api.ynab.com/v1';

/**
 * Get Firestore database instance
 */
function getDb() {
  return admin.firestore();
}

/**
 * Refresh YNAB access token if expired
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Valid access token
 */
async function getValidYnabToken(userId) {
  const db = getDb();
  const tokenDoc = await db.collection('ynab_tokens').doc(userId).get();

  if (!tokenDoc.exists) {
    throw new Error('YNAB not connected for this user');
  }

  const { access_token, refresh_token, updated_at } = tokenDoc.data();

  // Check if token is likely expired (> 1 hour old)
  const tokenAge = Date.now() - new Date(updated_at).getTime();
  const ONE_HOUR = 60 * 60 * 1000;

  if (tokenAge > ONE_HOUR) {
    logger.info('Refreshing YNAB token', { userId, tokenAge: Math.round(tokenAge / 1000 / 60) + ' minutes' });

    try {
      const newTokens = await refreshYnabToken(refresh_token);

      await db.collection('ynab_tokens').doc(userId).update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        updated_at: new Date().toISOString()
      });

      return newTokens.access_token;
    } catch (error) {
      logger.error('Failed to refresh YNAB token', { userId, error: error.message });
      throw new Error('YNAB token refresh failed. User needs to re-authenticate.');
    }
  }

  return access_token;
}

/**
 * Refresh YNAB OAuth token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - New tokens
 */
async function refreshYnabToken(refreshToken) {
  const response = await axios.post('https://app.ynab.com/oauth/token', {
    client_id: process.env.YNAB_CLIENT_ID,
    client_secret: process.env.YNAB_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  return response.data;
}

/**
 * Fetch all YNAB data needed for newsletter
 * @param {string} accessToken - YNAB access token
 * @returns {Promise<Object>} - { budgetId, accounts, transactions, categories }
 */
async function fetchYnabData(accessToken) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json'
  };

  // First get budgets
  const budgetsResponse = await axios.get(`${YNAB_API_BASE_URL}/budgets`, { headers });
  const budgets = budgetsResponse.data?.data?.budgets || [];

  if (budgets.length === 0) {
    throw new Error('No YNAB budgets found');
  }

  // Use the first budget (or default budget)
  const budget = budgets.find(b => b.name === 'My Budget') || budgets[0];
  const budgetId = budget.id;

  logger.info('Fetching YNAB data', { budgetId, budgetName: budget.name });

  // Fetch accounts, transactions, and categories in parallel
  const [accountsResponse, transactionsResponse, categoriesResponse] = await Promise.all([
    axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/accounts`, { headers }),
    axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/transactions`, { headers }),
    axios.get(`${YNAB_API_BASE_URL}/budgets/${budgetId}/categories`, { headers })
  ]);

  const accounts = accountsResponse.data?.data?.accounts || [];
  const transactions = transactionsResponse.data?.data?.transactions || [];
  const categories = categoriesResponse.data?.data || {};

  logger.info('YNAB data fetched', {
    accountCount: accounts.length,
    transactionCount: transactions.length,
    categoryGroupCount: categories.category_groups?.length || 0
  });

  return {
    budgetId,
    accounts,
    transactions,
    categories
  };
}

/**
 * Get historical newsletter snapshots for trend comparison
 * @param {string} userId - User ID
 * @param {number} limit - Number of snapshots to retrieve
 * @returns {Promise<Array>} - Historical snapshots
 */
async function getHistoricalSnapshots(userId, limit = 52) {
  const db = getDb();

  try {
    const snapshotsQuery = await db.collection('newsletter_snapshots')
      .where('userId', '==', userId)
      .orderBy('weekEnding', 'desc')
      .limit(limit)
      .get();

    return snapshotsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    // Handle missing Firestore index gracefully
    if (error.code === 9 || error.message?.includes('index')) {
      logger.warn('Newsletter snapshots index not yet created - returning empty snapshots', {
        userId,
        indexUrl: error.message?.match(/https:\/\/[^\s]+/)?.[0]
      });
      return [];
    }
    throw error;
  }
}

/**
 * Get user's CSP settings from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - CSP settings
 */
async function getCspSettings(userId) {
  const db = getDb();
  const doc = await db.collection('csp_settings').doc(userId).get();

  if (!doc.exists) {
    return {};
  }

  const data = doc.data();
  return {
    categoryMappings: data.categoryMappings || {},
    excludedCategories: new Set(data.excludedCategories || []),
    excludedPayees: new Set(data.excludedPayees || []),
    excludedExpenseCategories: new Set(data.excludedExpenseCategories || []),
    useKeywordFallback: data.settings?.useKeywordFallback ?? false,
    settings: data.settings || {}
  };
}

/**
 * Get user's newsletter settings
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Newsletter settings
 */
async function getNewsletterSettings(userId) {
  const db = getDb();
  const doc = await db.collection('newsletter_settings').doc(userId).get();

  if (!doc.exists) {
    // Return defaults
    return {
      recipients: getRecipients(),
      enabled: true,
      dayOfWeek: 6, // Saturday
      hour: 9,
      timezone: process.env.NEWSLETTER_TIMEZONE || 'America/Los_Angeles',
      goals: {
        savingsRate: 25,
        investmentContributions: 24000
      }
    };
  }

  return doc.data();
}

/**
 * Save newsletter snapshot to Firestore
 * @param {string} userId - User ID
 * @param {Object} metrics - Calculated metrics
 * @param {Object} trends - Calculated trends
 * @returns {Promise<string>} - Snapshot ID
 */
async function saveSnapshot(userId, metrics, trends) {
  const db = getDb();
  const now = new Date();

  const snapshot = {
    userId,
    weekEnding: formatDate(now),
    month: now.toISOString().slice(0, 7),
    year: now.getFullYear(),
    createdAt: now.toISOString(),

    // Core metrics
    netWorth: metrics.netWorth?.total || 0,
    cashReserves: metrics.runway?.cashReserves || 0,
    runwayMonths: metrics.runway?.pureRunwayMonths || 0,
    buckets: {
      fixedCosts: metrics.csp?.buckets?.fixedCosts?.percentage || 0,
      investments: metrics.csp?.buckets?.investments?.percentage || 0,
      savings: metrics.csp?.buckets?.savings?.percentage || 0,
      guiltFree: metrics.csp?.buckets?.guiltFree?.percentage || 0
    },

    // Monthly tracking
    monthlyIncome: metrics.csp?.monthlyIncome || 0,
    monthlyExpenses: metrics.runway?.avgMonthlyExpenses || 0,
    monthlySavingsRate: trends?.monthOverMonth?.currentMonth?.savingsRate || 0,

    // Annual tracking
    ytdSavings: trends?.annualProgress?.ytd?.savings || 0,
    ytdInvestmentContributions: trends?.annualProgress?.ytd?.investments || 0,

    // Top category spending
    categorySpending: (metrics.topCategories || [])
      .slice(0, 10)
      .reduce((acc, cat) => {
        acc[cat.name] = cat.amount;
        return acc;
      }, {})
  };

  const docRef = await db.collection('newsletter_snapshots').add(snapshot);
  logger.info('Snapshot saved', { userId, snapshotId: docRef.id });

  return docRef.id;
}

/**
 * Log newsletter generation result
 * @param {string} userId - User ID
 * @param {Object} result - Generation result
 * @returns {Promise<string>} - Log ID
 */
async function logNewsletterRun(userId, result) {
  const db = getDb();

  const log = {
    userId,
    startedAt: result.startedAt,
    completedAt: new Date().toISOString(),
    status: result.status,
    errors: result.errors || [],
    metrics: {
      duration: Date.now() - new Date(result.startedAt).getTime(),
      emailsSent: result.emailsSent || 0,
      aiTokens: result.aiTokens || 0,
      aiFallback: result.aiFallback || false
    },
    snapshotId: result.snapshotId || null
  };

  const docRef = await db.collection('newsletter_logs').add(log);
  return docRef.id;
}

/**
 * Generate and send newsletter
 * @param {string} userId - User ID
 * @param {Object} options - Options (skipAI, skipEmail)
 * @returns {Promise<Object>} - Result
 */
async function generateAndSend(userId, options = {}) {
  const { skipAI = false, skipEmail = false } = options;
  const startedAt = new Date().toISOString();
  const errors = [];

  logger.info('Newsletter generation started', { userId, skipAI, skipEmail });

  try {
    // Step 0: Dedup check — skip if already sent successfully in last 6 hours
    const db = getDb();
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    try {
      const recentSendQuery = await db.collection('newsletter_logs')
        .where('userId', '==', userId)
        .where('status', '==', 'success')
        .where('startedAt', '>', sixHoursAgo)
        .limit(1)
        .get();

      if (!recentSendQuery.empty) {
        const lastSend = recentSendQuery.docs[0].data();
        logger.info('Newsletter already sent recently, skipping', {
          userId,
          lastSentAt: lastSend.completedAt || lastSend.startedAt
        });
        return {
          success: true,
          status: 'skipped',
          reason: 'already_sent_recently',
          lastSentAt: lastSend.completedAt || lastSend.startedAt
        };
      }
    } catch (dedupError) {
      // If dedup check fails (e.g. missing index), log and continue
      if (dedupError.code === 9 || dedupError.message?.includes('index')) {
        logger.warn('Dedup check skipped - Firestore index not yet created', {
          userId,
          indexUrl: dedupError.message?.match(/https:\/\/[^\s]+/)?.[0]
        });
      } else {
        logger.warn('Dedup check failed, continuing with send', { userId, error: dedupError.message });
      }
    }

    // Step 1: Get YNAB token
    const accessToken = await getValidYnabToken(userId);

    // Step 2: Fetch YNAB data
    let ynabData;
    try {
      ynabData = await fetchYnabData(accessToken);
    } catch (fetchError) {
      logger.error('YNAB data fetch failed', { userId, error: fetchError.message, stage: 'fetchYnabData' });
      errors.push({ stage: 'fetchYnabData', error: fetchError.message });
      throw fetchError;
    }

    // Step 3: Get user settings
    const [cspSettings, newsletterSettings, snapshots] = await Promise.all([
      getCspSettings(userId),
      getNewsletterSettings(userId),
      getHistoricalSnapshots(userId)
    ]);

    // Step 4: Calculate metrics
    let metrics;
    try {
      metrics = calculateAllMetrics(ynabData, {
        periodMonths: 6,
        cspSettings
      });
    } catch (metricsError) {
      logger.error('Metrics calculation failed', { userId, error: metricsError.message, stage: 'calculateMetrics' });
      errors.push({ stage: 'calculateMetrics', error: metricsError.message });
      throw metricsError;
    }

    logger.info('Metrics calculated', {
      userId,
      netWorth: metrics.netWorth?.total,
      runway: metrics.runway?.pureRunwayMonths
    });

    // Step 5: Calculate trends
    let trends;
    try {
      trends = calculateAllTrends(
        ynabData.transactions,
        metrics,
        snapshots,
        newsletterSettings.goals,
        metrics.investmentAccountIds,
        cspSettings
      );
    } catch (trendsError) {
      logger.error('Trends calculation failed', { userId, error: trendsError.message, stage: 'calculateTrends' });
      errors.push({ stage: 'calculateTrends', error: trendsError.message });
      throw trendsError;
    }

    logger.info('Trends calculated', { userId });

    // Step 6: Generate AI analysis
    let aiAnalysis = null;
    let aiTokens = 0;
    let aiFallback = false;

    if (!skipAI) {
      try {
        const aiResult = await generateAnalysis({ metrics, trends });
        aiAnalysis = aiResult.analysis;
        aiTokens = aiResult.usage?.total_tokens || 0;
        aiFallback = aiResult.fallback || false;

        logger.info('AI analysis completed', {
          userId,
          tokens: aiTokens,
          fallback: aiFallback
        });
      } catch (aiError) {
        logger.error('AI analysis failed', { userId, error: aiError.message });
        errors.push({ stage: 'ai', error: aiError.message });
      }
    }

    // Step 7: Generate HTML
    const weekEnding = formatDate(new Date());
    const html = generateNewsletterHtml({
      metrics,
      trends,
      aiAnalysis,
      weekEnding
    });

    const subject = generateSubject({ weekEnding, trends });

    // Step 8: Save snapshot
    let snapshotId;
    try {
      snapshotId = await saveSnapshot(userId, metrics, trends);
    } catch (snapshotError) {
      logger.error('Snapshot save failed', { userId, error: snapshotError.message, stage: 'saveSnapshot' });
      errors.push({ stage: 'saveSnapshot', error: snapshotError.message });
      // Non-fatal: continue to send email even if snapshot fails
      snapshotId = null;
    }

    // Step 9: Send email
    let emailsSent = 0;
    if (!skipEmail) {
      const recipients = newsletterSettings.recipients || getRecipients();

      if (recipients.length > 0) {
        try {
          const emailResult = await sendNewsletter({
            recipients,
            subject,
            html
          });

          emailsSent = emailResult.sent;
          logger.info('Newsletter sent', { userId, emailsSent, recipients });

          if (emailResult.failed > 0) {
            errors.push({
              stage: 'email',
              error: `${emailResult.failed} emails failed to send`,
              details: emailResult.details.failed
            });
          }
        } catch (emailError) {
          logger.error('Email sending failed', { userId, error: emailError.message });
          errors.push({ stage: 'email', error: emailError.message });
        }
      } else {
        logger.warn('No recipients configured', { userId });
        errors.push({ stage: 'email', error: 'No recipients configured' });
      }
    }

    // Step 10: Log result
    const status = errors.length === 0 ? 'success' : (emailsSent > 0 ? 'partial' : 'failed');

    try {
      await logNewsletterRun(userId, {
        startedAt,
        status,
        errors,
        emailsSent,
        aiTokens,
        aiFallback,
        snapshotId
      });
    } catch (logError) {
      logger.error('Newsletter log save failed', { userId, error: logError.message, stage: 'logNewsletterRun' });
      // Non-fatal: don't throw, the newsletter was already sent
    }

    logger.info('Newsletter generation completed', { userId, status, emailsSent });

    return {
      success: status !== 'failed',
      status,
      emailsSent,
      snapshotId,
      errors: errors.length > 0 ? errors : undefined,
      aiTokens,
      aiFallback
    };

  } catch (error) {
    logger.error('Newsletter generation failed', { userId, error: error.message, stack: error.stack });

    try {
      await logNewsletterRun(userId, {
        startedAt,
        status: 'failed',
        errors: [{ stage: 'general', error: error.message }],
        emailsSent: 0
      });
    } catch (logError) {
      logger.error('Failed to log newsletter failure', { userId, error: logError.message, stage: 'logNewsletterRun' });
    }

    throw error;
  }
}

/**
 * Generate preview HTML without sending
 * @param {string} userId - User ID
 * @returns {Promise<string>} - HTML content
 */
async function generatePreview(userId) {
  const accessToken = await getValidYnabToken(userId);
  const ynabData = await fetchYnabData(accessToken);
  const [cspSettings, newsletterSettings, snapshots] = await Promise.all([
    getCspSettings(userId),
    getNewsletterSettings(userId),
    getHistoricalSnapshots(userId)
  ]);

  const metrics = calculateAllMetrics(ynabData, { periodMonths: 6, cspSettings });
  const trends = calculateAllTrends(ynabData.transactions, metrics, snapshots, newsletterSettings.goals, metrics.investmentAccountIds, cspSettings);

  // Generate AI analysis for preview
  let aiAnalysis = null;
  try {
    const aiResult = await generateAnalysis({ metrics, trends });
    aiAnalysis = aiResult.analysis;
  } catch (error) {
    logger.warn('AI analysis failed for preview', { error: error.message });
  }

  const weekEnding = formatDate(new Date());
  return generateNewsletterHtml({ metrics, trends, aiAnalysis, weekEnding });
}

/**
 * Build AI prompt without calling API (for debugging)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { prompt, estimatedTokens }
 */
async function buildAIPrompt(userId) {
  const accessToken = await getValidYnabToken(userId);
  const ynabData = await fetchYnabData(accessToken);
  const [cspSettings, newsletterSettings, snapshots] = await Promise.all([
    getCspSettings(userId),
    getNewsletterSettings(userId),
    getHistoricalSnapshots(userId)
  ]);

  const metrics = calculateAllMetrics(ynabData, { periodMonths: 6, cspSettings });
  const trends = calculateAllTrends(ynabData.transactions, metrics, snapshots, newsletterSettings.goals, metrics.investmentAccountIds, cspSettings);

  return getAnalysisPrompt({ metrics, trends });
}

/**
 * Get newsletter status for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Status info
 */
async function getStatus(userId) {
  const db = getDb();

  try {
    const lastLogQuery = await db.collection('newsletter_logs')
      .where('userId', '==', userId)
      .orderBy('startedAt', 'desc')
      .limit(1)
      .get();

    if (lastLogQuery.empty) {
      return {
        hasRun: false,
        message: 'No newsletters sent yet',
        nextScheduled: getNextSaturday9am(process.env.NEWSLETTER_TIMEZONE)
      };
    }

    const lastLog = lastLogQuery.docs[0].data();

    return {
      hasRun: true,
      lastSent: lastLog.completedAt,
      status: lastLog.status,
      emailsSent: lastLog.metrics?.emailsSent || 0,
      nextScheduled: getNextSaturday9am(process.env.NEWSLETTER_TIMEZONE)
    };
  } catch (error) {
    // Handle missing Firestore index gracefully
    if (error.code === 9 || error.message?.includes('index')) {
      logger.warn('Newsletter logs index not yet created', {
        userId,
        indexUrl: error.message?.match(/https:\/\/[^\s]+/)?.[0]
      });
      return {
        hasRun: false,
        message: 'Newsletter logs index being created - check back shortly',
        nextScheduled: getNextSaturday9am(process.env.NEWSLETTER_TIMEZONE)
      };
    }
    throw error;
  }
}

/**
 * Get recent newsletter logs
 * @param {string} userId - User ID
 * @param {number} limit - Number of logs
 * @returns {Promise<Array>} - Logs
 */
async function getLogs(userId, limit = 10) {
  const db = getDb();

  try {
    const logsQuery = await db.collection('newsletter_logs')
      .where('userId', '==', userId)
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get();

    return logsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    // Handle missing Firestore index gracefully
    if (error.code === 9 || error.message?.includes('index')) {
      logger.warn('Newsletter logs index not yet created', {
        userId,
        indexUrl: error.message?.match(/https:\/\/[^\s]+/)?.[0]
      });
      return [];
    }
    throw error;
  }
}

/**
 * Validate newsletter configuration
 * @returns {Object} - Configuration status
 */
function validateConfiguration() {
  const emailConfig = validateEmailConfig();
  const aiConfig = validateAiConfig();

  return {
    ready: emailConfig.configured && (aiConfig.configured || true), // AI is optional
    email: emailConfig,
    ai: aiConfig,
    ynab: {
      configured: !!process.env.YNAB_CLIENT_ID && !!process.env.YNAB_CLIENT_SECRET
    },
    timezone: process.env.NEWSLETTER_TIMEZONE || 'America/Los_Angeles'
  };
}

module.exports = {
  generateAndSend,
  generatePreview,
  buildAIPrompt,
  getStatus,
  getLogs,
  validateConfiguration,
  getValidYnabToken,
  fetchYnabData
};
