const { similarity } = require('./fuzzyMatcher')

const SEED_SERVICES = [
  'Netflix', 'Spotify', 'Prime', 'Amazon Prime', 'JioHotstar', 'Hotstar',
  'Disney', 'YouTube', 'YouTube Premium', 'ChatGPT', 'OpenAI', 'Google One',
  'iCloud', 'Apple Music', 'Zee5', 'SonyLIV', 'Airtel', 'Jio', 'Vi',
  'Broadband', 'Electricity', 'Rent', 'Gym', 'Notion', 'Canva', 'Cursor', 'ChatGPT Plus'
]

const dynamicServices = new Set(
  SEED_SERVICES.map((name) => name.toLowerCase())
)

function registerService(name) {
  const cleaned = String(name || '').trim()
  if (!cleaned || cleaned.length < 2) {
    return null
  }
  const key = cleaned.toLowerCase()
  dynamicServices.add(key)
  return cleaned
}

function listServices() {
  return [...dynamicServices]
}

function extractServiceCandidate(text) {
  if (/^(?:delete|remove|cancel)$/i.test(text.trim())) {
    return null
  }

  if (/^(?:in|after)\s+\d+\s*(?:minutes?|mins?|hours?|hrs?|days?)\s+remind\s+me\b/i.test(text.trim())) {
    return null
  }

  if (/\bremind\s+me\s+to\b/i.test(text) || /^remind\s+[a-z]/i.test(text.trim())) {
    return null
  }

  const patterns = [
    /^([a-z0-9+][a-z0-9+.\s-]{0,24}?)\s+every\s+month\b/i,
    /\b(?:my|the)\s+([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+(?:ends?|expires?|expired|runs out|valid till|stops?)\b/i,
    /^([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+(?:ends?|expires?|expired|runs out)\b/i,
    /^([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+renews?\b/i,
    /\b(?:for|about)\s+([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+(?:subscription|reminder|renewal)\b/i,
    /^add\s+([a-z0-9+][a-z0-9+.\s-]{1,30}?)(?:\s+subscription)?\b/i,
    /^(?:subscription|sub)\s+([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+(?:monthly|yearly|premium|membership)\b/i,
    /\btrack\s+([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+renewal\b/i,
    /^([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+(?:monthly|yearly|premium|membership)\b/i,
    /^([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+(?:tomorrow|today|tonight|next week|next month)\b/i,
    /^([a-z0-9+][a-z0-9+.\s-]{1,30}?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  const words = text.split(/\s+/).filter((w) => /^[a-z0-9+]/i.test(w))
  for (let len = Math.min(3, words.length); len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ')
      if (
        phrase.length >= 3 &&
        !/^(need|must|pay|buy|call|tomorrow|today|before|after|remind|renew|driving|licen[cs]e|mom|milk|doctor|gym|emi|rent|hour|minute|an)$/i.test(phrase) &&
        !/\bremind\s+me\b/i.test(phrase)
      ) {
        const catalogHit = matchCatalog(phrase)
        if (catalogHit) {
          return catalogHit
        }
      }
    }
  }

  return null
}

function matchCatalog(candidate) {
  const lower = String(candidate || '').toLowerCase().trim()
  if (!lower) {
    return null
  }

  let best = null
  let bestScore = 0

  for (const service of dynamicServices) {
    const score = similarity(lower, service)
    if (score >= 0.72 && score > bestScore) {
      bestScore = score
      best = service
    }
  }

  if (best) {
    return best
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  if (/^[a-z][a-z0-9+]{2,}$/i.test(lower) && lower.length <= 24) {
    registerService(lower)
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }

  return null
}

module.exports = {
  SEED_SERVICES,
  registerService,
  listServices,
  extractServiceCandidate,
  matchCatalog
}
