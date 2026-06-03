function applyTypoFixes(text) {
  return String(text)
    .replace(/\brenewls\b|\brenewes\b|\brenws\b|\brnews\b/gi, 'renews')
    .replace(/\bsubscritpion\b|\bsubscriuption\b/gi, 'subscription')
    .replace(/\bremiander\b/gi, 'reminder')
    .replace(/\btomorw\b|\btmrw\b/gi, 'tomorrow')
}

function normalizeText(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeParserText(text) {
  return normalizeText(text)
    .replace(/[\u2013\u2014\u2212–—]/g, '-')
    .replace(/,/g, ' ')
    .replace(/=/g, ' ')
    .replace(/(\D)-(\d)/g, '$1 - $2')
    .replace(/(\d)-(\D)/g, '$1 - $2')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/:(?=\s*\d)/g, ' ')
    .trim()
}

function normalizeForIntentMatch(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

module.exports = {
  normalizeText,
  normalizeParserText,
  normalizeForIntentMatch,
  applyTypoFixes
}
