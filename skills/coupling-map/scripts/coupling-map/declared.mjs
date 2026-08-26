const RELATIVE = '\\.{1,2}/'

function escapeForRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function internal(prefixes) {
  const alternatives = [RELATIVE].concat((prefixes || []).map(escapeForRegExp))
  return "['\"](" + alternatives.join('|') + ")[^'\"]*['\"]"
}

export function countDeclared(text, prefixes) {
  const source = internal(prefixes)
  const patterns = [
    new RegExp('\\bfrom\\s+' + source, 'g'),
    new RegExp('\\bimport\\s+' + source, 'g'),
    new RegExp('\\bimport\\(\\s*' + source + '\\s*\\)', 'g'),
    new RegExp('\\brequire\\(\\s*' + source + '\\s*\\)', 'g'),
  ]
  let total = 0
  for (const pattern of patterns) total += (text.match(pattern) || []).length
  return total
}
