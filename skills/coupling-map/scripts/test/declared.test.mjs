// skills/coupling-map/scripts/test/declared.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countDeclared } from '../coupling-map/declared.mjs'

// The non-relative prefixes are a property of the PROJECT, not of the counter:
// this monorepo resolves 'app/...' through baseUrl, another one may use '@app/'
// or nothing at all. Hardcoding them meant that on any other project the
// denominator would silently undercount - and undercounting reads as HIGHER
// coverage, which is the direction where the guard stays quiet.
const PABX = ['app/', 'src/', 'environments/', 'shared/', 'core/']

// This counter is the denominator of the coverage guard, which is the only thing
// standing between a broken graph and a report that renders and looks plausible.
// Undercounting here reads as HIGHER coverage, so every miss below is a step
// towards the guard staying silent when it should abort.

test('a relative static import counts', () => {
  assert.equal(countDeclared("import { A } from './a.service'\n", PABX), 1)
})

test('a non-relative import resolved through baseUrl counts', () => {
  assert.equal(countDeclared("import { A } from 'app/shared/a.service'\n", PABX), 1)
})

test('a relative require counts', () => {
  assert.equal(countDeclared("const a = require('./a')\n", PABX), 1)
})

test('a non-relative require resolved through baseUrl counts', () => {
  assert.equal(countDeclared("const a = require('app/shared/a')\n", PABX), 1)
})

test('a dynamic import counts', () => {
  assert.equal(countDeclared("loadChildren: () => import('./admin/admin.module')\n", PABX), 1)
})

test('export star counts', () => {
  assert.equal(countDeclared("export * from './public-api'\n", PABX), 1)
})

test('a named re-export counts', () => {
  assert.equal(countDeclared("export { A } from './a.service'\n", PABX), 1)
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
  assert.equal(countDeclared(source, PABX), 3)
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
  assert.equal(countDeclared(source, PABX), 0)
})

test('a core-js style package name is not mistaken for the core/ prefix', () => {
  assert.equal(countDeclared("import 'core-js/stable'\n", PABX), 0)
})

// These two were once missed, and the miss was invisible: it read as HIGHER
// coverage on a repository where it happened to be 88 imports out of ~3100.
// It was never a small bug. TypeScript formatted at printWidth 80 - which this
// monorepo's own frontend declares - puts most named imports on several lines,
// so on another project the multi-line case is the majority of the file, and
// the guard would report health over a graph that had collapsed. The fix was to
// stop matching the statement and match the specifier: 'from' always sits on the
// specifier's line, so the pattern never has to cross a newline at all.

test('an import spanning multiple lines counts', () => {
  const source = ['import {', '  A,', '  B,', "} from './a.service'", ''].join('\n')
  assert.equal(countDeclared(source, PABX), 1)
})

test('several multi-line imports count once each, not once per line', () => {
  const source = [
    'import {',
    '  A,',
    '  B,',
    "} from './a.service'",
    'import {',
    '  C,',
    "} from 'app/shared/c.service'",
    '',
  ].join('\n')
  assert.equal(countDeclared(source, PABX), 2)
})

test('a bare side-effect import has no from and still counts', () => {
  assert.equal(countDeclared("import './testing/chart-js-mock'\n", PABX), 1)
})

test('a static import counts once, not once for import and once for from', () => {
  assert.equal(countDeclared("import A from './a.service'\n", PABX), 1)
})

test('an empty file counts nothing and does not throw', () => {
  assert.equal(countDeclared('', PABX), 0)
})


test('a project that declares no prefixes still counts its relative imports', () => {
  // Relative paths are the one form every project has, so they are built in and
  // never configured. Everything else is an alias this project happens to use.
  assert.equal(countDeclared("import { A } from './a'", []), 1)
  assert.equal(countDeclared("import { A } from './a'", undefined), 1)
})

test('an alias only counts once the project declares it', () => {
  // The whole point of the change: with the prefixes hardcoded, any project not
  // using this monorepo's aliases undercounted its denominator, coverage read
  // higher than the truth, and the guard stayed quiet.
  const line = "import { A } from '@app/a'"
  assert.equal(countDeclared(line, []), 0)
  assert.equal(countDeclared(line, ['@app/']), 1)
})

test('a prefix carrying regex punctuation is matched literally', () => {
  // '~/' and '@app/' are ordinary, but a prefix like 'lib.core/' would turn its
  // dot into a wildcard and start matching things it should not.
  assert.equal(countDeclared("import { A } from 'lib.core/a'", ['lib.core/']), 1)
  assert.equal(countDeclared("import { A } from 'libXcore/a'", ['lib.core/']), 0)
})
