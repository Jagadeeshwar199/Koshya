const { INTENTS } = require('./intentService')
const logger = require('../../utils/logger')

const MODEL = 'gemini-2.5-flash'
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 12000)
const INTENT_SET = new Set(Object.values(INTENTS))

function buildPrompt(rawMessage, normalized, deterministic) {
  const intents = Object.values(INTENTS).join(', ')
  return [
    'Classify this Koshya WhatsApp message into exactly one intent.',
    `Allowed intents: ${intents}`,
    'Reply with JSON only, no markdown:',
    '{"intent":"<INTENT>","confidence":0.0-1.0,"entities":{},"reasoning":"short explanation"}',
    '',
    `message: ${normalized || rawMessage}`,
    `deterministic_intent: ${deterministic?.intent || 'none'}`,
    `deterministic_confidence: ${deterministic?.confidence ?? 'none'}`,
    `entities: ${JSON.stringify(deterministic?.entities || {})}`
  ].join('\n')
}

function failResult(prompt, reason, extra = {}) {
  return {
    model: MODEL,
    prompt_sent: prompt,
    ai_response: extra.ai_response ?? null,
    ai_intent: extra.ai_intent ?? null,
    confidence: extra.confidence ?? null,
    token_usage: extra.token_usage ?? null,
    success: false,
    failure_reason: reason
  }
}

function okResult(prompt, aiResponse, aiIntent, confidence, tokenUsage, entities = {}) {
  return {
    model: MODEL,
    prompt_sent: prompt,
    ai_response: aiResponse,
    ai_intent: aiIntent,
    entities,
    confidence,
    token_usage: tokenUsage,
    success: true,
    failure_reason: null
  }
}

function normalizeEntities(obj) {
  const e = obj && typeof obj === 'object' ? obj : {}
  const out = {}
  if (e.serviceName || e.service) out.serviceName = e.serviceName || e.service
  if (e.amount != null) out.amount = Number(e.amount)
  if (e.actionText || e.title) out.actionText = e.actionText || e.title
  if (e.date) out.date = e.date
  return out
}

function parseJsonText(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw
  return JSON.parse(candidate)
}

function mapIntent(value) {
  const key = String(value || '').trim().toUpperCase()
  if (INTENT_SET.has(key)) return key
  return INTENTS.UNKNOWN
}

function extractUsage(response) {
  const u = response?.usageMetadata || response?.usage || null
  if (!u) return null
  return {
    prompt_tokens: u.promptTokenCount ?? u.prompt_tokens ?? null,
    completion_tokens: u.candidatesTokenCount ?? u.completion_tokens ?? null,
    total_tokens: u.totalTokenCount ?? u.total_tokens ?? null
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('gemini_timeout')), ms)
    promise
      .then((v) => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

async function callGemini(prompt) {
  const { GoogleGenAI } = require('@google/genai')
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return withTimeout(
    client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    }),
    TIMEOUT_MS
  )
}

async function parseWithAI({ rawMessage, normalized, deterministic }) {
  const prompt = buildPrompt(rawMessage, normalized, deterministic)
  const telemetry = { raw_message: rawMessage, normalized_message: normalized }

  if (process.env.AI_INTENT_ENABLED !== 'true') {
    logger.info('ai_intent.disabled', { reason: 'ai_disabled' })
    return { ...telemetry, ...failResult(prompt, 'ai_disabled') }
  }

  if (!process.env.GEMINI_API_KEY) {
    logger.error('ai_intent.missing_key', {})
    return { ...telemetry, ...failResult(prompt, 'missing_gemini_api_key') }
  }

  try {
    logger.info('ai_intent.request', { model: MODEL, message: normalized || rawMessage })
    const response = await callGemini(prompt)
    const text = response?.text || ''
    logger.info('ai_intent.response', { model: MODEL, length: text.length })

    let parsed
    try {
      parsed = parseJsonText(text)
    } catch (parseErr) {
      logger.error('ai_intent.json_parse_failed', { error: parseErr.message, text: text.slice(0, 500) })
      return { ...telemetry, ...failResult(prompt, 'invalid_json_response', { ai_response: text }) }
    }

    const aiIntent = mapIntent(parsed.intent)
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence)))
    if (!Number.isFinite(confidence)) {
      return { ...telemetry, ...failResult(prompt, 'invalid_confidence', { ai_response: text, ai_intent: aiIntent }) }
    }

    logger.info('ai_intent.classified', {
      ai_intent: aiIntent,
      confidence,
      reasoning: parsed.reasoning || null,
      mapped_unknown: aiIntent === INTENTS.UNKNOWN && parsed.intent !== INTENTS.UNKNOWN
    })

    const entities = normalizeEntities(parsed.entities)
    return { ...telemetry, ...okResult(prompt, text, aiIntent, confidence, extractUsage(response), entities) }
  } catch (err) {
    const reason = err.message === 'gemini_timeout' ? 'gemini_timeout' : 'gemini_request_failed'
    logger.error('ai_intent.failed', { reason, error: err.message, stack: err.stack })
    if (err.message?.includes("Cannot find module '@google/genai'")) {
      return { ...telemetry, ...failResult(prompt, 'gemini_sdk_missing') }
    }
    return { ...telemetry, ...failResult(prompt, reason, { ai_response: err.message }) }
  }
}

module.exports = { parseWithAI, buildPrompt }
