const intentDetector = require('../intent/intentDetector')

module.exports = {
  INTENTS: intentDetector.INTENTS,
  detectIntent: intentDetector.detectIntent,
  mergeDateEntities: intentDetector.mergeDateEntities,
  needsExplicitTimePrompt: intentDetector.needsExplicitTimePrompt,
  extractOffset: intentDetector.extractOffset
}
