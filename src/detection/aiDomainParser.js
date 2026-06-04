/** Gemini infers domain/action/entities only — never executes. EXTENSION: new domains in prompt. */
const { Domain, Action } = require('./types')
const logger = require('../../utils/logger')

const MODEL = 'gemini-2.5-flash'
const DOMAIN_SET = new Set(Object.values(Domain))
const ACTION_SET = new Set(Object.values(Action))

function buildPrompt(rawMessage, normalized, partial) {
  return [
    'Infer Koshya message structure. Do NOT choose execution or commands.',
    `Allowed domains: ${[...DOMAIN_SET].join(', ')}`,
    `Allowed actions: ${[...ACTION_SET].join(', ')}`,
    'Reply JSON only:',
    '{"domain":"DOMAIN","action":"ACTION","confidence":0.0-1.0,"entities":{"serviceName":null,"amount":null,"actionText":null},"reasoning":"brief"}',
    `message: ${normalized || rawMessage}`,
    `partial: ${JSON.stringify(partial || {})}`
  ].join('\n')
}

function parseJson(text) {
  const raw = String(text || '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return JSON.parse(fenced ? fenced[1].trim() : raw)
}

function mapDomain(v) {
  const k = String(v || '').trim().toUpperCase()
  return DOMAIN_SET.has(k) ? k : Domain.UNKNOWN
}

function mapAction(v) {
  const k = String(v || '').trim().toUpperCase()
  return ACTION_SET.has(k) ? k : Action.UNKNOWN
}

async function inferWithAI({ rawMessage, normalized, partial }) {
  const prompt = buildPrompt(rawMessage, normalized, partial)
  const telemetry = { raw_message: rawMessage, normalized_message: normalized, model: MODEL }

  if (process.env.AI_INTENT_ENABLED !== 'true' || !process.env.GEMINI_API_KEY) {
    return { ...telemetry, success: false, failure_reason: 'ai_disabled' }
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
    const entities = {}
    if (parsed.entities?.serviceName) entities.serviceName = parsed.entities.serviceName
    if (parsed.entities?.amount != null) entities.amount = Number(parsed.entities.amount)
    if (parsed.entities?.actionText) entities.actionText = parsed.entities.actionText

    return {
      ...telemetry,
      success: true,
      prompt_sent: prompt,
      ai_response: text,
      domain: mapDomain(parsed.domain),
      action: mapAction(parsed.action),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      entities,
      failure_reason: null
    }
  } catch (err) {
    logger.error('ai_domain.failed', { error: err.message })
    return { ...telemetry, success: false, failure_reason: err.message, prompt_sent: prompt }
  }
}

module.exports = { inferWithAI, buildPrompt }
