const supabase = require('../../../config/supabase')
const logger = require('../../../utils/logger')
const { hashContent } = require('./hashUtil')

async function logStage(statementId, stage, event, payload = {}) {
  const row = { statement_id: statementId, stage, event, payload }
  const { error } = await supabase.from('bank_statement_detection_logs').insert(row)
  if (error) logger.error('bank_statement.log_failed', { statementId, stage, error: error.message })
  logger.info('bank_statement.stage', { statementId, stage, event })
  return row
}

async function findAwaitingPasswordStatement(userPhone) {
  const { data, error } = await supabase
    .from('bank_statements')
    .select('*')
    .eq('user_phone', userPhone)
    .in('status', ['awaiting_password', 'password_required'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

async function clearAwaitingPasswordStatement(statementId) {
  await updateStatementStatus(statementId, 'cancelled')
  await logStage(statementId, 'password', 'entry_cancelled', {})
}

async function findByHash(userPhone, fileHash) {
  const { data, error } = await supabase
    .from('bank_statements')
    .select('*')
    .eq('user_phone', userPhone)
    .eq('file_hash', fileHash)
    .maybeSingle()
  if (error) throw error
  return data
}

async function getStatement(statementId) {
  const { data, error } = await supabase.from('bank_statements').select('*').eq('id', statementId).maybeSingle()
  if (error) throw error
  if (!data) {
    const err = new Error('statement not found')
    err.status = 404
    throw err
  }
  return data
}

async function createStatement({ userPhone, fileName, fileType, rawContent, fileHash = null, bankName = null }) {
  logger.info('bank_statement.debug.insert_before', {
    supabaseUrl: process.env.SUPABASE_URL || null,
    usesServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    userPhone,
    fileType,
    fileHash
  })
  const { data, error } = await supabase
    .from('bank_statements')
    .insert({
      user_phone: userPhone,
      file_name: fileName || null,
      file_type: fileType,
      raw_content: rawContent,
      file_hash: fileHash,
      bank_name: bankName,
      status: 'uploaded'
    })
    .select('*')
    .single()
  if (error) {
    logger.error('bank_statement.debug.insert_failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    })
    throw error
  }
  logger.info('bank_statement.debug.insert_after', { statementId: data.id, status: data.status })
  await logStage(data.id, 'upload', 'statement_created', { fileName, fileType, fileHash, bankName })
  return data
}

async function saveTransactions(statementId, txns) {
  const rows = txns.map((t) => ({
    statement_id: statementId,
    txn_date: t.txnDate,
    description: t.description,
    raw_description: t.description,
    normalized_merchant: t.normalizedMerchant || null,
    amount: t.amount,
    debit_credit: t.debitCredit,
    raw_line: t.rawLine,
    row_index: t.rowIndex,
    txn_type: t.txnType || null
  }))
  const { data, error } = await supabase.from('bank_statement_transactions').insert(rows).select('*')
  if (error) throw error
  await logStage(statementId, 'extract', 'transactions_saved', {
    count: data.length,
    mappings: rows.slice(0, 20).map((r) => ({ raw: r.raw_description, normalized: r.normalized_merchant }))
  })
  return data
}

async function saveMerchant(statementId, group) {
  const { data, error } = await supabase
    .from('bank_statement_merchants')
    .upsert(
      {
        statement_id: statementId,
        merchant_key: group.merchantKey,
        normalized_name: group.normalizedName,
        raw_names: group.rawNames
      },
      { onConflict: 'statement_id,merchant_key' }
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function saveScore(statementId, merchantId, scored, usedAi = false, confidenceBefore = null, confidenceAfter = null) {
  const before = confidenceBefore ?? scored.confidence
  const after = confidenceAfter ?? scored.confidence
  const { data, error } = await supabase
    .from('bank_statement_detection_scores')
    .insert({
      statement_id: statementId,
      merchant_id: merchantId,
      confidence: after,
      confidence_before: before,
      confidence_after: after,
      breakdown: scored.breakdown,
      rule_result: scored.ruleResult,
      used_ai: usedAi
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function saveAiCall(statementId, merchantId, call) {
  const { data, error } = await supabase
    .from('bank_statement_ai_calls')
    .insert({
      statement_id: statementId,
      merchant_id: merchantId,
      model: call.model || 'gemini-2.5-flash',
      prompt: call.prompt,
      response: call.response,
      success: call.success,
      failure_reason: call.failureReason || null,
      confidence_before: call.confidenceBefore ?? null,
      confidence_after: call.confidenceAfter ?? null
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function saveRejection(statementId, merchantId, { merchantName, confidence, rejectionReason }) {
  const { data, error } = await supabase
    .from('bank_statement_rejections')
    .insert({
      statement_id: statementId,
      merchant_id: merchantId,
      merchant_name: merchantName,
      confidence,
      rejection_reason: rejectionReason
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function saveResult(statementId, merchantId, result, shownText) {
  const { data, error } = await supabase
    .from('bank_statement_detection_results')
    .insert({
      statement_id: statementId,
      merchant_id: merchantId,
      service_name: result.serviceName,
      amount: result.amount,
      recurrence: result.recurrence,
      confidence: result.confidence,
      source: result.source,
      shown_text: shownText
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function saveFeedback({ statementId, resultId, userPhone, correction }) {
  const { data, error } = await supabase
    .from('bank_statement_feedback')
    .insert({
      statement_id: statementId,
      result_id: resultId || null,
      user_phone: userPhone,
      correction: correction || {}
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function updateStatement(statementId, patch) {
  await supabase
    .from('bank_statements')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', statementId)
}

async function updateStatementStatus(statementId, status) {
  await updateStatement(statementId, { status })
}

async function getResults(statementId) {
  const { data, error } = await supabase
    .from('bank_statement_detection_results')
    .select('*')
    .eq('statement_id', statementId)
    .order('confidence', { ascending: false })
  if (error) throw error
  return data || []
}

async function markResultConfirmed(resultId, subscriptionId) {
  const { data, error } = await supabase
    .from('bank_statement_detection_results')
    .update({
      user_confirmed: true,
      confirmed_at: new Date().toISOString(),
      subscription_id: subscriptionId
    })
    .eq('id', resultId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

module.exports = {
  logStage,
  hashContent,
  findAwaitingPasswordStatement,
  clearAwaitingPasswordStatement,
  findByHash,
  getStatement,
  createStatement,
  saveTransactions,
  saveMerchant,
  saveScore,
  saveAiCall,
  saveRejection,
  saveResult,
  saveFeedback,
  updateStatement,
  updateStatementStatus,
  getResults,
  markResultConfirmed
}
