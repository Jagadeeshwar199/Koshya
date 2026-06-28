const axios = require('axios')
const logger = require('../../utils/logger')

const MAX_BYTES = Number(process.env.BANK_STATEMENT_MAX_BYTES || 5 * 1024 * 1024)

function resolveFileType(name, contentType) {
  const n = String(name || '').toLowerCase()
  const ct = String(contentType || '').toLowerCase()
  if (n.endsWith('.pdf') || ct.includes('pdf')) return 'pdf'
  if (n.endsWith('.csv') || ct.includes('csv') || ct.includes('comma-separated')) return 'csv'
  return null
}

function prepareStatementContent(buffer, fileType) {
  if (fileType === 'pdf') return buffer.toString('base64')
  return buffer.toString('utf8')
}

async function downloadGupshupFile(url) {
  const headers = {}
  if (process.env.GUPSHUP_API_KEY) {
    headers.apikey = process.env.GUPSHUP_API_KEY
  }
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES,
    headers
  })
  return Buffer.from(response.data)
}

async function downloadStatementFile(url, uploadId = null) {
  logger.info('media.download_start', { uploadId, url })
  try {
    const buffer = await downloadGupshupFile(url)
    if (buffer.length > MAX_BYTES) {
      const err = new Error('file_too_large')
      logger.error('media.download_failed', {
        uploadId,
        stage: 'media.download_failed',
        message: err.message,
        stack: err.stack,
        url
      })
      return { error: 'file_too_large' }
    }
    logger.info('media.download_success', { uploadId, url, bytes: buffer.length })
    return { buffer }
  } catch (err) {
    logger.error('media.download_failed', {
      uploadId,
      stage: 'media.download_failed',
      message: err.message,
      stack: err.stack,
      url,
      response: err.response?.data
    })
    return { error: 'download_failed' }
  }
}

module.exports = {
  resolveFileType,
  prepareStatementContent,
  downloadStatementFile
}
