const INTERNAL = "['\"](\\.{1,2}/|app/|src/|environments/|shared/|core/)[^'\"]*['\"]"

const FROM = new RegExp('\\bfrom\\s+' + INTERNAL, 'g')
const BARE = new RegExp('\\bimport\\s+' + INTERNAL, 'g')
const DYNAMIC = new RegExp('\\bimport\\(\\s*' + INTERNAL + '\\s*\\)', 'g')
const REQUIRED = new RegExp('\\brequire\\(\\s*' + INTERNAL + '\\s*\\)', 'g')

export function countDeclared(text) {
  return (
    (text.match(FROM) || []).length +
    (text.match(BARE) || []).length +
    (text.match(DYNAMIC) || []).length +
    (text.match(REQUIRED) || []).length
  )
}
