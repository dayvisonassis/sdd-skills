// skills/coupling-map/scripts/test/declared.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countDeclared } from '../coupling-map/declared.mjs'

// This counter is the denominator of the coverage guard, which is the only thing
// standing between a broken graph and a report that renders and looks plausible.
// Undercounting here reads as HIGHER coverage, so every miss below is a step
// towards the guard staying silent when it should abort.

test('a relative static import counts', () => {
  assert.equal(countDeclared("import { A } from './a.service'\n"), 1)
})

test('a non-relative import resolved through baseUrl counts', () => {
  assert.equal(countDeclared("import { A } from 'app/shared/a.service'\n"), 1)
})

test('a relative require counts', () => {
  assert.equal(countDeclared("const a = require('./a')\n"), 1)
})

test('a non-relative require resolved through baseUrl counts', () => {
  assert.equal(countDeclared("const a = require('app/shared/a')\n"), 1)
})

test('a dynamic import counts', () => {
  assert.equal(countDeclared("loadChildren: () => import('./admin/admin.module')\n"), 1)
})

test('export star counts', () => {
  assert.equal(countDeclared("export * from './public-api'\n"), 1)
})

test('a named re-export counts', () => {
  assert.equal(countDeclared("export { A } from './a.service'\n"), 1)
})

test('several imports in one file are counted individually', () => {
  const source = [
    "import { Component } from '@angular/core'",
    "import { A } from './a.service'",
    "import { B } from 'app/shared/b.service'",
    "const c = require('./c')",
    '',
    'export class Thing {}',
    '',
  ].join('\n')
  assert.equal(countDeclared(source), 3)
})

// Negative cases. A package import never becomes an edge in the graph, so counting
// it would depress coverage against a denominator madge was never going to resolve,
// and abort healthy runs for no reason. '@angular/core' is the one that matters:
// it ends in 'core' and appears in nearly every file of the frontend, so a pattern
// anchored loosely enough to match it would inflate the denominator by thousands.
test('package imports and requires do not count', () => {
  const source = [
    "import { Component } from '@angular/core'",
    "import { Observable } from 'rxjs'",
    "import moment from 'moment'",
    "const fs = require('fs')",
    "const knex = require('knex')",
    "const lazy = import('lodash-es')",
    '',
  ].join('\n')
  assert.equal(countDeclared(source), 0)
})

test('a core-js style package name is not mistaken for the core/ prefix', () => {
  assert.equal(countDeclared("import 'core-js/stable'\n"), 0)
})

// Known undercounts, pinned here deliberately rather than fixed quietly.
// Both make coverage read higher than it is, which is the unsafe direction, but
// widening the pattern is a separate decision with its own measurement: on the
// PABX monorepo these two miss 88 declared imports (87 multi-line, 1 bare) out of
// roughly 3100. The tests exist so the day someone widens them, the change is
// visible as a flipped assertion instead of a silently moving number.

test('KNOWN UNDERCOUNT: an import spanning multiple lines is not seen', () => {
  const source = ['import {', '  A,', '  B,', "} from './a.service'", ''].join('\n')
  assert.equal(countDeclared(source), 0)
})

test('KNOWN UNDERCOUNT: a bare side-effect import has no from and is not seen', () => {
  assert.equal(countDeclared("import './testing/chart-js-mock'\n"), 0)
})

test('an empty file counts nothing and does not throw', () => {
  assert.equal(countDeclared(''), 0)
})
