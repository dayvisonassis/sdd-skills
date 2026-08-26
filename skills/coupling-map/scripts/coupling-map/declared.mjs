const DECLARED =
  /(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s+['"](\.{1,2}\/|app\/|src\/|environments\/|shared\/|core\/)[^'"]*['"]/g
const DYNAMIC = /import\(\s*['"](\.{1,2}\/|app\/|src\/)[^'"]*['"]\s*\)/g
const REQUIRED =
  /require\(\s*['"](\.{1,2}\/|app\/|src\/|environments\/|shared\/|core\/)[^'"]*['"]\s*\)/g

export function countDeclared(text) {
  return (
    (text.match(DECLARED) || []).length +
    (text.match(DYNAMIC) || []).length +
    (text.match(REQUIRED) || []).length
  )
}
