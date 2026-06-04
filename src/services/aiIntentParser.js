const { INTENTS } = require('./intentService')

function buildPrompt(rawMessage, normalized, deterministic) {
  return JSON.stringify({
    message: normalized || rawMessage,
    deterministic_intent: deterministic?.intent,
    deterministic_confidence: deterministic?.confidence,
    entities: deterministic?.entities
  })
}

async function parseWithAI({ rawMessage, normalized, deterministic }) {
  const prompt = buildPrompt(rawMessage, normalized, deterministic)
  if (process.env.AI_INTENT_ENABLED !== 'true') {
    return {
      prompt_sent: prompt,
      ai_response: null,
      ai_intent: null,
      confidence: null,
      token_usage: null,
      success: false,
      failure_reason: 'ai_disabled'
    }
  }
  return {
    prompt_sent: prompt,
    ai_response: null,
    ai_intent: INTENTS.UNKNOWN,
    confidence: 0,
    token_usage: null,
    success: false,
    failure_reason: 'ai_not_integrated'
  }
}

module.exports = { parseWithAI, buildPrompt }
