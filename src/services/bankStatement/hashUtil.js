const crypto = require('crypto')

function hashContent(content) {
  return crypto.createHash('sha256').update(String(content || '')).digest('hex')
}

module.exports = { hashContent }
