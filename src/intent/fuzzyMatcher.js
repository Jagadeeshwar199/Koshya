function levenshtein(left, right) {
  const a = String(left || '')
  const b = String(right || '')
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i])

  for (let column = 1; column <= b.length; column++) {
    rows[0][column] = column
  }

  for (let row = 1; row <= a.length; row++) {
    for (let column = 1; column <= b.length; column++) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost
      )
    }
  }

  return rows[a.length][b.length]
}

function similarity(left, right) {
  const a = String(left || '').toLowerCase()
  const b = String(right || '').toLowerCase()
  if (!a || !b) {
    return 0
  }
  if (a === b || a.includes(b) || b.includes(a)) {
    return 1
  }
  const dist = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  return Math.max(0, 1 - dist / maxLen)
}

function bestTermMatch(text, terms, threshold = 0.34) {
  const normalized = String(text || '').toLowerCase()
  const tokens = normalized.split(/\s+/).filter(Boolean)
  let best = { term: null, score: 0 }

  for (const term of terms) {
    const termTokens = term.split(/\s+/).filter(Boolean)

    if (termTokens.length > 1 && normalized.includes(term)) {
      return { term, score: 1 }
    }

    for (const token of tokens) {
      if (term.length >= 4 && token.length <= 3) {
        continue
      }
      const score = similarity(token, term)
      if (score >= threshold && score > best.score) {
        best = { term, score }
      }
    }

    const phraseScore = similarity(normalized.replace(/\s+/g, ''), term.replace(/\s+/g, ''))
    if (phraseScore >= threshold && phraseScore > best.score) {
      best = { term, score: phraseScore }
    }
  }

  return best
}

function groupScore(text, dictionary, threshold) {
  const match = bestTermMatch(text, dictionary, threshold)
  return match.score
}

module.exports = {
  levenshtein,
  similarity,
  bestTermMatch,
  groupScore
}
