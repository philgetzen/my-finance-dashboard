/**
 * Email Service
 * Resend integration for newsletter delivery
 */

const { Resend } = require('resend');
const logger = require('../logger');

// Initialize Resend client
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

/**
 * Send newsletter email to recipients
 * @param {Object} options - Email options
 * @param {string[]} options.recipients - Array of email addresses
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text fallback (optional)
 * @returns {Promise<Object>} - Send result
 */
async function sendNewsletter(options) {
  const {
    recipients,
    subject,
    html,
    text
  } = options;

  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (!recipients?.length) {
    throw new Error('No recipients specified');
  }

  const fromEmail = process.env.NEWSLETTER_FROM_EMAIL || 'onboarding@resend.dev';

  const results = {
    sent: [],
    failed: []
  };

  // Send to each recipient
  for (const recipient of recipients) {
    try {
      const { data, error } = await resend.emails.send({
        from: `Finance Dashboard <${fromEmail}>`,
        to: recipient,
        subject,
        html,
        text: text || stripHtml(html)
      });

      if (error) {
        throw new Error(error.message);
      }

      results.sent.push(recipient);
      logger.info('Email sent successfully', { recipient, id: data?.id });
    } catch (error) {
      results.failed.push({
        recipient,
        error: error.message
      });
      logger.error('Failed to send email', {
        recipient,
        error: error.message
      });
    }
  }

  return {
    success: results.failed.length === 0,
    sent: results.sent.length,
    failed: results.failed.length,
    details: results
  };
}

/**
 * Send test email to verify configuration
 * @param {string} recipient - Test recipient email
 * @returns {Promise<boolean>} - True if successful
 */
async function sendTestEmail(recipient) {
  const subject = 'Finance Newsletter - Test Email';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a;">Test Email Successful!</h1>
      <p>Your newsletter email configuration is working correctly.</p>
      <p style="color: #666; font-size: 14px;">
        Sent at: ${new Date().toISOString()}
      </p>
    </div>
  `;

  const result = await sendNewsletter({
    recipients: [recipient],
    subject,
    html
  });

  return result.success;
}

/**
 * Strip HTML tags for plain text fallback
 * @param {string} html - HTML content
 * @returns {string} - Plain text
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Validate email configuration
 * @returns {Object} - Configuration status
 */
function validateConfig() {
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const hasFromEmail = !!process.env.NEWSLETTER_FROM_EMAIL;
  const hasRecipients = !!process.env.NEWSLETTER_RECIPIENTS;

  const recipients = hasRecipients
    ? process.env.NEWSLETTER_RECIPIENTS.split(',').map(e => e.trim()).filter(Boolean)
    : [];

  return {
    configured: hasApiKey && hasFromEmail && hasRecipients,
    hasApiKey,
    hasFromEmail,
    hasRecipients,
    recipientCount: recipients.length,
    fromEmail: process.env.NEWSLETTER_FROM_EMAIL || null
  };
}

/**
 * Get configured recipients
 * @returns {string[]} - Array of recipient emails
 */
function getRecipients() {
  const recipientsEnv = process.env.NEWSLETTER_RECIPIENTS || '';
  return recipientsEnv.split(',').map(e => e.trim()).filter(Boolean);
}

module.exports = {
  sendNewsletter,
  sendTestEmail,
  validateConfig,
  getRecipients
};
