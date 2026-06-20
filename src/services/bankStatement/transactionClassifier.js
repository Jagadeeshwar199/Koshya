const LOAN = /\b(?:EMI|LOAN|LENDING|MORTGAGE|HOMELOAN|PERSONALLOAN|CARLOAN|BAJAJ FIN|HDFC LTD|ICICI LTD)\b/i
const SUB = /\b(?:NETFLIX|SPOTIFY|PRIME|AMAZON PRIME|HOTSTAR|DISNEY|YOUTUBE|APPLE\.COM|GOOGLE ONE|MICROSOFT|ADOBE|ZOOM|DROPBOX|GITHUB|NOTION|SLACK|OPENAI|CHATGPT)\b/i
const UTIL = /\b(?:ELECTRIC|ELECTRICITY|WATER|GAS|BESCOM|TATA POWER|AIRTEL|JIO|VI POSTPAID|BROADBAND|ACT FIBERNET|FIBERNET)\b/i
const INS = /\b(?:INSURANCE|LIC|POLICY PREMIUM|HDFC LIFE|ICICI PRU)\b/i
const INV = /\b(?:SIP|MUTUAL FUND|ZERODHA|GROWW|UPSTOX|NPS|PPF)\b/i
const SHOP = /\b(?:AMAZON|FLIPKART|MYNTRA|SWIGGY|ZOMATO|BLINKIT|DMART)\b/i
const XFER = /\b(?:NEFT|IMPS|RTGS|UPI TRANSFER|TRANSFER TO|TRANSFER FROM|SELF TRANSFER)\b/i

function classifyTransaction(description) {
  const d = String(description || '')
  if (LOAN.test(d)) return 'loan_repayment'
  if (SUB.test(d)) return 'subscription'
  if (UTIL.test(d)) return 'utility'
  if (INS.test(d)) return 'insurance'
  if (INV.test(d)) return 'investment'
  if (SHOP.test(d)) return 'shopping'
  if (XFER.test(d)) return 'transfer'
  return 'unknown'
}

module.exports = { classifyTransaction }
