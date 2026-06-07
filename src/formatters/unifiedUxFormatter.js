function formatGotIt(task, schedule) {
  const lines = ['✅ Got it', '', String(task || 'Task').trim()]
  if (schedule) lines.push(String(schedule).trim())
  return lines.join('\n')
}

module.exports = { formatGotIt }
