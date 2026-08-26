import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function reportPath(outDir) {
  return resolve(outDir, 'index.html')
}

export function reportUrl(outDir) {
  return pathToFileURL(reportPath(outDir)).href
}

export function openCommand(platform, target) {
  if (platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'start', '', target] }
  }
  if (platform === 'darwin') {
    return { command: 'open', args: [target] }
  }
  return { command: 'xdg-open', args: [target] }
}
