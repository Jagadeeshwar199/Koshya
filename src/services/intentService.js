const intentDetector = require('../intent/intentDetector')

module.exports = {
  INTENTS: intentDetector.INTENTS,
  detectIntent: intentDetector.detectIntent,
  detectClauseIntents: intentDetector.detectClauseIntents,
  mergeDateEntities: intentDetector.mergeDateEntities,
  needsExplicitTimePrompt: intentDetector.needsExplicitTimePrompt,
  extractOffset: intentDetector.extractOffset,
  MIN_CONFIDENCE: intentDetector.MIN_CONFIDENCE
}
