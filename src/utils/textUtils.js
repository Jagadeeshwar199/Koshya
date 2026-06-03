function applyTypoFixes(text) {
  return String(text)
    .replace(/\brenewls\b|\brenewes\b|\brenws\b|\brnews\b/gi, 'renews')
    .replace(/\bsubscritpion\b|\bsubscriuption\b/gi, 'subscription')
    .replace(/\bremiander\b/gi, 'reminder')
    .replace(/\bremindars?\b/gi, 'remind')
    .replace(/\bremnders?\b/gi, 'remind')
    .replace(/\bsuscription\b/gi, 'subscription')
    .replace(/\bsubscripton\b/gi, 'subscription')
    .replace(/\brem1nd\b/gi, 'remind')
    .replace(/\brem!nd\b/gi, 'remind')
    .replace(/\br3mind\b/gi, 'remind')
    .replace(/\b0n\b/gi, 'on')
    .replace(/\bnetfl!x\b/gi, 'netflix')
    .replace(/\btomorw\b|\btmrw\b|\btomoro\b/gi, 'tomorrow')
    .replace(/\btommorow\b|\btommorrow\b/gi, 'tomorrow')
    .replace(/\bexpries\b|\bexprie\b/gi, 'expires')
    .replace(/\bnetflx\b/gi, 'netflix')
    .replace(/\bspoitfy\b/gi, 'spotify')
    .replace(/\brenewl\b/gi, 'renews')
    .replace(/\bremeber\b|\bremeind\b/gi, 'remind')
    .replace(/\balrm\b/gi, 'alarm')
    .replace(/\bnotifiy\b/gi, 'notify')
    .replace(/\bsubcription\b|\bsubscrption\b/gi, 'subscription')
    .replace(/\bremnder\b/gi, 'remind')
    .replace(/\bremindar\b/gi, 'remind')
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
