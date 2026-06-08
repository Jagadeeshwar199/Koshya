/** Canonical event — execution uses event_name, trigger_time, recurrence only. */

/**
 * @typedef {object} CanonicalEvent
 * @property {string} message
 * @property {string} event_name
 * @property {object|null} trigger_time
 * @property {string|null} recurrence
 * @property {number} confidence
 */

/**
 * @typedef {object} ParseResult
 * @property {string} rawMessage
 * @property {string} normalized
 * @property {string} event_name
 * @property {string} scheduleText
 * @property {object} entities
 * @property {string} domain
 * @property {string} action
 * @property {string} intent
 * @property {number} confidence
 * @property {boolean} parser_used
 * @property {boolean} ai_used
 * @property {string|null} failure_reason
 * @property {object} [meta]
 */

/**
 * @typedef {object} AnalyticsRecord
 * @property {string} raw_message
 * @property {CanonicalEvent} normalized_event
 * @property {string|null} predicted_event_type
 * @property {number} confidence
 * @property {string} execution_result
 * @property {string|null} failure_reason
 * @property {boolean} parser_used
 * @property {boolean} ai_used
 */

module.exports = {}
