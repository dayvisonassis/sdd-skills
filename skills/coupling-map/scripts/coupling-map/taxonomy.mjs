const NO_DOMAIN = '(sem domínio)'

function suffixLayer(fileName, layers) {
  const parts = fileName.split('.')
  if (parts.length < 3) return null
  const candidate = parts[parts.length - 2]
  return layers.includes(candidate) ? candidate : null
}

function folderLayer(segments, layers) {
  for (const segment of segments) {
    if (layers.includes(segment)) return segment
  }
  return null
}

function stripSuffix(fileName) {
  const parts = fileName.split('.')
  return parts.length > 2 ? parts.slice(0, -2).join('.') : parts[0]
}

export function classify(relPath, appConfig) {
  const segments = relPath.split('/')
  const fileName = segments[segments.length - 1]
  const folders = segments.slice(0, -1)

  const layer =
    appConfig.layerFrom === 'suffix'
      ? suffixLayer(fileName, appConfig.layers)
      : folderLayer(folders, appConfig.layers)

  if (appConfig.requireLayerForDomain && layer === null) {
    return { app: appConfig.name, domain: NO_DOMAIN, layer }
  }

  if (appConfig.domainFrom === 'firstFolderUnder') {
    const baseIndex = folders.indexOf(appConfig.domainBase)
    if (baseIndex === -1) {
      return { app: appConfig.name, domain: NO_DOMAIN, layer }
    }
    const after = folders[baseIndex + 1]
    const domain = after === undefined ? stripSuffix(fileName) : after
    return { app: appConfig.name, domain, layer }
  }

  return { app: appConfig.name, domain: stripSuffix(fileName), layer }
}
