// skills/coupling-map/scripts/test/taxonomy.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify } from '../coupling-map/taxonomy.mjs'

const FRONTEND = {
  name: 'frontend',
  root: 'apps/frontend/src',
  domainFrom: 'firstFolderUnder',
  domainBase: 'app',
  layerFrom: 'suffix',
  layers: ['component', 'service', 'model', 'module', 'guard', 'interceptor', 'directive', 'pipe', 'resolver', 'helpers'],
}

const BACKEND = {
  name: 'backend',
  root: 'apps/backend/src',
  domainFrom: 'basename',
  layerFrom: 'folder',
  layers: ['routes', 'controllers', 'models', 'services', 'middleware', 'functions', 'utils', 'config', 'jobs', 'socket'],
  requireLayerForDomain: true,
}

test('frontend: domain is the first folder under app/, layer is the suffix', () => {
  assert.deepEqual(
    classify('app/dialer/campaigns/form-campaigns/form-campaigns.component.ts', FRONTEND),
    { app: 'frontend', domain: 'dialer', layer: 'component' }
  )
})

test('frontend: a file sitting directly under app/ takes its basename as domain', () => {
  assert.deepEqual(
    classify('app/event-emitter.service.ts', FRONTEND),
    { app: 'frontend', domain: 'event-emitter', layer: 'service' }
  )
})

test('frontend: an unknown suffix yields a null layer, never a guess', () => {
  assert.deepEqual(
    classify('app/reports/reports.routes.ts', FRONTEND),
    { app: 'frontend', domain: 'reports', layer: null }
  )
})

test('backend: domain is the basename without suffix, layer is the folder', () => {
  assert.deepEqual(
    classify('api/v2/models/dialer.model.js', BACKEND),
    { app: 'backend', domain: 'dialer', layer: 'models' }
  )
})

test('backend: a controller and its model share one domain', () => {
  const a = classify('api/v2/models/dialer.model.js', BACKEND)
  const b = classify('api/v2/controllers/dialer.controller.js', BACKEND)
  assert.equal(a.domain, b.domain)
  assert.notEqual(a.layer, b.layer)
})

test('backend: middleware keeps its own domain', () => {
  assert.deepEqual(
    classify('middleware/authorization.middleware.js', BACKEND),
    { app: 'backend', domain: 'authorization', layer: 'middleware' }
  )
})

test('anything unclassifiable lands in the visible bucket, never dropped', () => {
  assert.deepEqual(
    classify('something/else/weird.js', BACKEND),
    { app: 'backend', domain: '(sem domínio)', layer: null }
  )
})

test('layerFrom is honoured independently of domainFrom: folder layers under a domain folder', () => {
  const config = {
    name: 'other', domainFrom: 'firstFolderUnder', domainBase: 'src',
    layerFrom: 'folder', layers: ['services', 'repositories'],
  }
  assert.deepEqual(
    classify('src/billing/services/charge.js', config),
    { app: 'other', domain: 'billing', layer: 'services' }
  )
})

test('layerFrom is honoured independently of domainFrom: suffix layers with basename domains', () => {
  const config = {
    name: 'other', domainFrom: 'basename',
    layerFrom: 'suffix', layers: ['service', 'model'],
  }
  assert.deepEqual(
    classify('billing.service.js', config),
    { app: 'other', domain: 'billing', layer: 'service' }
  )
})

test('without requireLayerForDomain an unrecognised layer still keeps its derived domain', () => {
  const config = {
    name: 'other', domainFrom: 'basename',
    layerFrom: 'folder', layers: ['services'],
  }
  assert.deepEqual(
    classify('somewhere/odd/billing.js', config),
    { app: 'other', domain: 'billing', layer: null }
  )
})

test('a derivable layer survives an underivable domain', () => {
  // Layer and domain resolve independently, so failing to place a file in a
  // domain must not discard the layer we can still read off its name. Nulling
  // it would reintroduce the coupling this interface exists to remove, and the
  // layer feeds the colour axis and the direction detector.
  assert.deepEqual(
    classify('shared/foo.component.ts', FRONTEND),
    { app: 'frontend', domain: '(sem domínio)', layer: 'component' }
  )
})
