const { extractTransactions } = require('./parserService')
const { groupByMerchant, normalizeMerchant } = require('./merchantNormalizer')
const { classifyTransaction } = require('./transactionClassifier')
const { detectRecurringGroups } = require('./recurringDetector')
const { scoreRecurringCandidate } = require('./confidenceScorer')
const { reviewLowConfidence, shouldUseAi, RULE_THRESHOLD } = require('./aiReviewService')
const {
  formatResultLine,
  formatResultsMessage,
  formatConfirmationMessage,
  rejectionReason
} = require('./messageUtil')
const store = require('./storeService')
const { ApiError } = require('../../utils/apiError')

function inferRenewalDay(group) {
  const dated = (group?.transactions || []).filter((t) => t.txnDate).sort((a, b) => a.txnDate.localeCompare(b.txnDate))
  const latest = dated[dated.length - 1]
  if (!latest) return null
  return Number(latest.txnDate.slice(8, 10))
}

function normalizeRecurrence(value) {
  const raw = String(value || 'monthly').toLowerCase().trim()
  if (raw === 'monthly' || raw === 'yearly') return raw
  const m = raw.match(/^(\d+)\s+months?$/)
  if (m) return `${m[1]} months`
  return 'monthly'
}

async function processRecurringGroups(statementId, recurring) {
  const finalResults = []

  for (const group of recurring) {
    const merchant = await store.saveMerchant(statementId, group)
    const scored = scoreRecurringCandidate(group)
    await store.saveScore(statementId, merchant.id, scored, false, scored.confidence, scored.confidence)

    let result = null

    if (scored.confidence >= RULE_THRESHOLD && scored.ruleResult.isSubscription) {
      result = {
        serviceName: scored.ruleResult.serviceName,
        amount: scored.ruleResult.amount,
        recurrence: scored.ruleResult.recurrence,
        confidence: scored.confidence,
        source: 'rule',
        renewalDay: inferRenewalDay(group)
      }
      await store.logStage(statementId, 'score', 'rule_accepted', {
        merchant: group.normalizedName,
        confidence: scored.confidence,
        breakdown: scored.breakdown
      })
    } else if (shouldUseAi(scored.confidence)) {
      const ai = await reviewLowConfidence(group, scored.confidence)
      await store.saveAiCall(statementId, merchant.id, ai)
      if (ai.result) {
        result = { ...ai.result, renewalDay: inferRenewalDay(group) }
        await store.saveScore(
          statementId,
          merchant.id,
          { ...scored, confidence: ai.result.confidence },
          true,
          scored.confidence,
          ai.result.confidence
        )
      } else {
        await store.saveRejection(statementId, merchant.id, {
          merchantName: group.normalizedName,
          confidence: scored.confidence,
          rejectionReason: rejectionReason(scored, true)
        })
      }
      await store.logStage(statementId, 'ai', ai.success ? 'ai_review_done' : 'ai_review_failed', {
        merchant: group.normalizedName,
        confidenceBefore: scored.confidence,
        confidenceAfter: ai.confidenceAfter
      })
    } else {
      await store.saveRejection(statementId, merchant.id, {
        merchantName: group.normalizedName,
        confidence: scored.confidence,
        rejectionReason: rejectionReason(scored, false)
      })
      await store.logStage(statementId, 'score', 'merchant_rejected', {
        merchant: group.normalizedName,
        confidence: scored.confidence,
        reason: rejectionReason(scored, false)
      })
    }

    if (result) {
      const shownText = formatResultLine(result)
      const saved = await store.saveResult(statementId, merchant.id, result, shownText)
      finalResults.push({
        resultId: saved.id,
        serviceName: result.serviceName,
        amount: result.amount,
        recurrence: result.recurrence,
        confidence: result.confidence,
        source: result.source,
        renewalDay: result.renewalDay
      })
    }
  }

  return finalResults
}

async function analyzeStatement({ userPhone, fileName, fileType, content, statementId = null, password = null }) {
  const fileHash = store.hashContent(content)

  if (!statementId) {
    const duplicate = await store.findByHash(userPhone, fileHash)
    if (duplicate) {
      const existingResults = await store.getResults(duplicate.id)
      return {
        statementId: duplicate.id,
        status: 'duplicate',
        transactionCount: null,
        bankName: duplicate.bank_name,
        subscriptions: existingResults.map((r) => ({
          resultId: r.id,
          serviceName: r.service_name,
          amount: r.amount,
          recurrence: r.recurrence,
          confidence: r.confidence,
          source: r.source
        })),
        message: 'This statement was already analyzed. Showing previous results.'
      }
    }
  }

  let statement = statementId
    ? await store.getStatement(statementId)
    : await store.createStatement({ userPhone, fileName, fileType, rawContent: content, fileHash })

  if (statement.user_phone !== userPhone) {
    throw new ApiError(403, 'statement does not belong to this user')
  }

  await store.updateStatementStatus(statement.id, 'processing')
  await store.logStage(statement.id, 'parse', 'started', { fileType, hasPassword: Boolean(password) })

  const extracted = await extractTransactions(content, fileType, password)
  if (extracted.passwordRequired) {
    await store.updateStatementStatus(statement.id, 'password_required')
    await store.logStage(statement.id, 'parse', 'password_required', {})
    return {
      statementId: statement.id,
      status: 'password_required',
      transactionCount: 0,
      bankName: null,
      subscriptions: [],
      message: 'This PDF is password protected. Send the password to continue.'
    }
  }
  if (extracted.error) {
    await store.updateStatementStatus(statement.id, 'failed')
    throw new ApiError(400, `failed to parse statement: ${extracted.error}`)
  }

  const bankName = extracted.bank || null
  if (bankName) {
    await store.updateStatement(statement.id, { bank_name: bankName })
  }

  const txns = (extracted.transactions || []).map((t) => ({
    ...t,
    normalizedMerchant: normalizeMerchant(t.description),
    txnType: classifyTransaction(t.description)
  }))

  await store.saveTransactions(statement.id, txns)
  await store.logStage(statement.id, 'normalize', 'group_merchants', { txnCount: txns.length, bankName })

  const groups = groupByMerchant(txns.filter((t) => t.txnType !== 'loan_repayment'))
  const recurring = detectRecurringGroups(groups)
  const finalResults = await processRecurringGroups(statement.id, recurring)

  const status = finalResults.length ? 'awaiting_confirmation' : 'completed'
  await store.updateStatementStatus(statement.id, status)
  await store.logStage(statement.id, 'complete', 'analysis_done', { resultCount: finalResults.length, status })

  return {
    statementId: statement.id,
    status,
    transactionCount: txns.length,
    bankName,
    subscriptions: finalResults,
    message: formatConfirmationMessage(finalResults)
  }
}

async function unlockStatement({ statementId, userPhone, password }) {
  if (!password || !String(password).trim()) {
    throw new ApiError(400, 'password is required')
  }
  const statement = await store.getStatement(statementId)
  if (statement.user_phone !== userPhone) {
    throw new ApiError(403, 'statement does not belong to this user')
  }
  if (statement.status !== 'password_required') {
    throw new ApiError(400, 'statement is not awaiting a password')
  }
  return analyzeStatement({
    userPhone,
    fileName: statement.file_name,
    fileType: statement.file_type,
    content: statement.raw_content,
    statementId: statement.id,
    password: String(password)
  })
}

async function confirmStatement({ statementId, userPhone, resultIds = null }) {
  const statement = await store.getStatement(statementId)
  if (statement.user_phone !== userPhone) {
    throw new ApiError(403, 'statement does not belong to this user')
  }

  const rows = await store.getResults(statementId)
  const pending = rows.filter((r) => !r.user_confirmed)
  const selected = Array.isArray(resultIds) && resultIds.length
    ? pending.filter((r) => resultIds.includes(r.id))
    : pending

  if (!selected.length) {
    throw new ApiError(400, 'no pending subscriptions to confirm')
  }

  const created = []
  const { createSubscriptionRecord } = require('../subscriptionService')
  for (const row of selected) {
    const subscription = await createSubscriptionRecord({
      userPhone,
      serviceName: row.service_name,
      amount: row.amount,
      recurrence: normalizeRecurrence(row.recurrence),
      renewalDay: null
    })
    await store.markResultConfirmed(row.id, subscription.id)
    created.push({ resultId: row.id, subscriptionId: subscription.id, serviceName: row.service_name })
  }

  await store.updateStatementStatus(statementId, 'confirmed')
  await store.logStage(statementId, 'confirm', 'subscriptions_created', { count: created.length })

  return {
    statementId,
    status: 'confirmed',
    created,
    message: `Added ${created.length} subscription${created.length === 1 ? '' : 's'}.`
  }
}

async function submitFeedback({ statementId, userPhone, resultId = null, correction = {} }) {
  const statement = await store.getStatement(statementId)
  if (statement.user_phone !== userPhone) {
    throw new ApiError(403, 'statement does not belong to this user')
  }
  const saved = await store.saveFeedback({ statementId, resultId, userPhone, correction })
  await store.logStage(statementId, 'feedback', 'user_correction', { resultId, correction })
  return { feedbackId: saved.id }
}

module.exports = {
  analyzeStatement,
  unlockStatement,
  confirmStatement,
  submitFeedback,
  formatResultsMessage,
  formatConfirmationMessage,
  formatResultLine,
  RULE_THRESHOLD
}
