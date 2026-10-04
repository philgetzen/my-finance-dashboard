const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Stub the Anthropic SDK before the service creates its client
const calls = [];
let respond;
const sdkPath = require.resolve('@anthropic-ai/sdk');
require.cache[sdkPath] = {
  id: sdkPath,
  filename: sdkPath,
  loaded: true,
  exports: class FakeAnthropic {
    constructor() {
      this.messages = {
        create: async (body, options) => {
          calls.push({ body, options });
          return respond(body);
        }
      };
    }
  }
};
process.env.ANTHROPIC_API_KEY = 'test-key';

const { generateAnalysis } = require('../aiAnalysisService');

const data = { metrics: {}, trends: {} };
const text = value => ({ type: 'text', text: value });
const reply = (model, content, extra = {}) => ({
  model,
  content,
  stop_reason: 'end_turn',
  usage: { input_tokens: 100, output_tokens: 50 },
  ...extra
});

beforeEach(() => {
  calls.length = 0;
});

test('Sonnet 5.5 answers at low effort with server-side fallback, and the text is read past the thinking block', async () => {
  respond = body => reply(body.model, [{ type: 'thinking', thinking: '' }, text('## This Week\nSpending is down.')]);

  const result = await generateAnalysis(data);

  assert.equal(result.analysis, '## This Week\nSpending is down.');
  assert.equal(result.model, 'claude-sonnet-5-5');
  assert.equal(result.fallback, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, 'claude-sonnet-5-5');
  assert.deepEqual(calls[0].body.output_config, { effort: 'low' });
  assert.equal(calls[0].body.fallbacks, 'default');
  assert.equal(calls[0].options.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
});

test('a refusal falls back to Haiku 4.5 without Sonnet-only settings', async () => {
  respond = body => body.model === 'claude-sonnet-5-5'
    ? reply(body.model, [], { stop_reason: 'refusal', stop_details: { category: 'general_harms' } })
    : reply(body.model, [text('Haiku summary')]);

  const result = await generateAnalysis(data);

  assert.equal(result.analysis, 'Haiku summary');
  assert.equal(result.model, 'claude-haiku-4-5');
  assert.equal(result.fallback, true);
  assert.equal(calls[1].body.model, 'claude-haiku-4-5');
  assert.equal(calls[1].body.output_config, undefined);
  assert.equal(calls[1].body.fallbacks, undefined);
  assert.equal(calls[1].options, undefined);
});

test('when both models fail, the template analysis is used', async () => {
  respond = () => { throw new Error('model not found'); };

  const result = await generateAnalysis(data);

  assert.equal(result.model, 'template-fallback');
  assert.equal(result.fallback, true);
  assert.equal(calls.map(c => c.body.model).join(','), 'claude-sonnet-5-5,claude-haiku-4-5');
});
