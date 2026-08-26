import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { reportPath, reportUrl, openCommand } from '../coupling-map/output.mjs'

// The script used to print 'architecture-report/index.html' - a relative path,
// which is neither clickable in a terminal nor pasteable into a browser. The
// reader had a file they could not open without first working out where it was.

test('the report path is absolute, whatever was passed in', () => {
  assert.equal(reportPath('architecture-report'), resolve('architecture-report', 'index.html'))
  assert.equal(reportPath('.'), resolve('index.html'))
})

test('the printed link is a file URL a browser accepts', () => {
  const url = reportUrl('architecture-report')
  assert.match(url, /^file:\/\/\//)
  assert.match(url, /index\.html$/)
  // A Windows path must not leak its backslashes or its bare drive letter into
  // the URL, or the terminal will not linkify it and the browser will refuse it.
  assert.equal(url.includes('\\'), false)
  assert.equal(/^file:\/\/\/[A-Za-z]:\//.test(url) || url.startsWith('file:///'), true)
})

test('a path with a space survives the round trip', () => {
  const url = reportUrl('my reports')
  assert.equal(url.includes(' '), false)
  assert.match(url, /my%20reports/)
})

test('each platform gets the opener it actually has', () => {
  assert.deepEqual(openCommand('darwin', '/tmp/a.html'), {
    command: 'open',
    args: ['/tmp/a.html'],
  })
  assert.deepEqual(openCommand('linux', '/tmp/a.html'), {
    command: 'xdg-open',
    args: ['/tmp/a.html'],
  })
})

test('the Windows opener passes an empty title before the target', () => {
  // `start` treats its first quoted argument as the window title, so a target
  // in first position is swallowed and a path containing spaces opens nothing.
  const { command, args } = openCommand('win32', 'C:\\reports\\index.html')
  assert.equal(command, 'cmd')
  assert.deepEqual(args, ['/c', 'start', '', 'C:\\reports\\index.html'])
  assert.equal(args[2], '', 'the empty title must sit between start and the target')
})

test('an unknown platform falls back rather than throwing', () => {
  const { command } = openCommand('freebsd', '/tmp/a.html')
  assert.equal(command, 'xdg-open')
})
