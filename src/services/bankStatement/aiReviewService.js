const logger = require('../../../utils/logger')

const MODEL = 'gemini-2.5-flash'
const RULE_THRESHOLD = 70
const AI_MIN = 50
const AI_MAX = 69

function shouldUseAi(confidence) {
  return confidence >= AI_MIN && confidence <= AI_MAX
}

function buildPrompt(group) {
  const history = group.transactions
    .slice(0, 12)
    .map((t) => `${t.txnDate || 'unknown'} | ${t.description} | ${t.amount}`)
    .join('\n')
  return [
    'Decide if this merchant is a recurring subscription from bank transactions.',
    'Reply JSON only:',
    '{"isSubscription":true|false,"serviceName":"Name","amount":number|null,"recurrence":"monthly|3 months|yearly|null","confidence":0-100,"reason":"brief"}',
    `merchant: ${group.normalizedName}`,
    'history:',
    history
  ].join('\n')
}

function parseJson(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return JSON.parse(fenced ? fenced[1].trim() : raw)
}

async function reviewLowConfidence(group, confidenceBefore) {
  const prompt = buildPrompt(group)
  if (process.env.AI_INTENT_ENABLED !== 'true' || !process.env.GEMINI_API_KEY) {
    return {
      success: false,
      prompt,
      response: null,
      failureReason: 'ai_disabled',
      result: null,
      confidenceBefore,
      confidenceAfter: null
    }
  }
  try {
    const { GoogleGenAI } = require('@google/genai')
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.1 }
    })
    const text = response?.text || ''
    const parsed = parseJson(text)
    if (!parsed?.isSubscription) {
      return {
        success: true,
        prompt,
        response: text,
        failureReason: null,
        result: null,
        model: MODEL,
        confidenceBefore,
        confidenceAfter: confidenceBefore
      }
    }
    const confidenceAfter = Math.min(100, Math.max(0, Number(parsed.confidence) || 75))
    return {
      success: true,
      prompt,
      response: text,
      failureReason: null,
      model: MODEL,
      confidenceBefore,
      confidenceAfter,
      result: {
        serviceName: parsed.serviceName || group.normalizedName,
        amount: parsed.amount ?? group.medianAmount,
        recurrence: parsed.recurrence || group.recurrence || 'monthly',
        confidence: confidenceAfter,
        source: 'ai'
      }
    }
  } catch (err) {
    logger.error('bank_statement.ai_failed', { error: err.message })
    return {
      success: false,
      prompt,
      response: null,
      failureReason: err.message,
      result: null,
      model: MODEL,
      confidenceBefore,
      confidenceAfter: null
    }
  }
}

module.exports = {
  reviewLowConfidence,
  buildPrompt,
  shouldUseAi,
  RULE_THRESHOLD,
  AI_MIN,
  AI_MAX,
  MODEL
}
