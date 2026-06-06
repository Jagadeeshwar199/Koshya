const { INTENTS } = require('./intentService')
const logger = require('../../utils/logger')

const MODEL = 'gemini-2.5-flash'
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 12000)
const INTENT_SET = new Set(Object.values(INTENTS))

function buildPrompt(rawMessage, normalized, deterministic, conversationState) {
  const intents = Object.values(INTENTS).join(', ')
  const cs = conversationState || {}
  const lines = [
    'Classify this Koshya WhatsApp message into exactly one intent.',
    `Allowed intents: ${intents}, UPDATE_REMINDER, UPDATE_SUBSCRIPTION`,
    'Reply with JSON only, no markdown:',
    '{"intent":"<INTENT>","confidence":0-100,"entities":{},"response":"WhatsApp reply for user","reasoning":"brief"}',
    'confidence is 0-100. response: short confirmation the user should see (use ✓, newlines).',
    '',
    `message: ${normalized || rawMessage}`
  ]
  if (cs.last_entity_type) {
    lines.push(`last_entity_id: ${cs.last_entity_id ?? ''}`)
    lines.push(`last_entity_type: ${cs.last_entity_type ?? ''}`)
    lines.push(`last_entity_title: ${cs.last_entity_title ?? ''}`)
    lines.push(`last_entity_time: ${cs.last_entity_time ?? ''}`)
    lines.push(
      'If last_entity_type is set AND the message starts with sorry, actually, instead, change, move, or make it (case insensitive), return intent UPDATE_REMINDER for reminder or UPDATE_SUBSCRIPTION for subscription. Use last_entity_id as target. Never CREATE a new row.'
    )
  }
  lines.push(
    `deterministic_intent: ${deterministic?.intent || 'none'}`,
    `deterministic_confidence: ${deterministic?.confidence ?? 'none'}`,
    `entities: ${JSON.stringify(deterministic?.entities || {})}`
  )
  return lines.join('\n')
}

function failResult(prompt, reason, extra = {}) {
  assertPromptBuilt(prompt)
  return {
    model: MODEL,
    prompt_sent: prompt,
    ai_response: extra.ai_response ?? null,
    ai_intent: extra.ai_intent ?? null,
    raw_ai_intent: extra.raw_ai_intent ?? extra.ai_intent ?? null,
    confidence: extra.confidence ?? null,
    token_usage: extra.token_usage ?? null,
    success: false,
    failure_reason: reason
  }
}

function okResult(prompt, aiResponse, aiIntent, confidence, tokenUsage, entities = {}, userResponse = null, rawAiIntent = null) {
  assertPromptBuilt(prompt)
  return {
    model: MODEL,
    prompt_sent: prompt,
    ai_response: aiResponse,
    ai_intent: aiIntent,
    raw_ai_intent: rawAiIntent || aiIntent,
    entities,
    confidence,
    userResponse,
    token_usage: tokenUsage,
    success: true,
    failure_reason: null
  }
}

function assertPromptBuilt(prompt) {
  if (!String(prompt || '').trim()) {
    logger.error('ai_intent.empty_prompt', {})
    throw new Error('ai_prompt_empty')
  }
}

function normalizeEntities(obj) {
  const e = obj && typeof obj === 'object' ? obj : {}
  const out = {}
  if (e.serviceName || e.service) out.serviceName = e.serviceName || e.service
  if (e.amount != null) out.amount = Number(e.amount)
  if (e.actionText || e.title) out.actionText = e.actionText || e.title
  if (e.date) out.date = e.date
  if (e.task) out.actionText = out.actionText || e.task
  if (e.time) out.time = e.time
  if (e.recurrence) out.recurrence = e.recurrence
  return out
}

function normalizeConfidence(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return n > 1 ? Math.min(100, n) / 100 : Math.min(1, Math.max(0, n))
}

function parseJsonText(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : raw
  return JSON.parse(candidate)
}

function mapIntent(value) {
  const key = String(value || '').trim().toUpperCase()
  if (key === 'UPDATE_REMINDER') return INTENTS.REMINDER_RESCHEDULE
  if (key === 'UPDATE_SUBSCRIPTION') return INTENTS.SUBSCRIPTION_UPDATE
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

async function parseWithAI({ rawMessage, normalized, deterministic, conversationState }) {
  const prompt = buildPrompt(rawMessage, normalized, deterministic, conversationState)
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

    const rawAiIntent = String(parsed.intent || '').trim().toUpperCase()
    const aiIntent = mapIntent(rawAiIntent)
    const confidence = normalizeConfidence(parsed.confidence)
    if (!Number.isFinite(confidence) || confidence <= 0) {
      return {
        ...telemetry,
        ...failResult(prompt, 'invalid_confidence', { ai_response: text, ai_intent: aiIntent, raw_ai_intent: rawAiIntent })
      }
    }
    const userResponse = String(parsed.response || '').trim() || null

    logger.info('ai_intent.classified', {
      ai_intent: aiIntent,
      confidence,
      reasoning: parsed.reasoning || null,
      mapped_unknown: aiIntent === INTENTS.UNKNOWN && parsed.intent !== INTENTS.UNKNOWN
    })

    const entities = normalizeEntities(parsed.entities)
    return {
      ...telemetry,
      ...okResult(prompt, text, aiIntent, confidence, extractUsage(response), entities, userResponse, rawAiIntent)
    }
  } catch (err) {
    const reason = err.message === 'gemini_timeout' ? 'gemini_timeout' : 'gemini_request_failed'
    logger.error('ai_intent.failed', { reason, error: err.message, stack: err.stack })
    if (err.message?.includes("Cannot find module '@google/genai'")) {
      return { ...telemetry, ...failResult(prompt, 'gemini_sdk_missing') }
    }
    return { ...telemetry, ...failResult(prompt, reason, { ai_response: err.message }) }
  }
}

module.exports = { parseWithAI, buildPrompt, assertPromptBuilt, MODEL }
