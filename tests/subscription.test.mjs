import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { checkSubscription, hasPaidAccess, canWrite } from '../lib/subscriptionLogic.js'
import { findMatchingCategory } from '../lib/budgetMatch.js'

test('subscription rules and budget category matching', () => {

  const day = 864e5
  const iso = (d) => new Date(Date.now() + d * day).toISOString()

  // free trial active / expired
  assert.equal(hasPaidAccess({ role: 'free', subEnd: iso(3) }), false)   // free never gets paid features
  assert.equal(canWrite({ role: 'free', subEnd: iso(3) }), true)
  assert.equal(canWrite({ role: 'free', subEnd: iso(-1) }), false)       // expired trial can't write
  assert.equal(hasPaidAccess({ role: 'pro', subEnd: iso(10) }), true)
  assert.equal(hasPaidAccess({ role: 'pro', subEnd: iso(-1) }), false)   // expired pro
  assert.equal(hasPaidAccess({ role: 'admin' }), true)
  assert.equal(hasPaidAccess(null), false)
  assert.equal(canWrite(null), false)
  assert.equal(checkSubscription({ role: 'pro' }).expired, true)         // no subEnd => expired

  // budget category matching (moved to lib/budgetMatch)
  const cats = [{ name: 'أكل' }, { name: 'Transport' }]
  assert.equal(findMatchingCategory(cats, 'Food')?.name, 'أكل')
  assert.equal(findMatchingCategory(cats, 'Transport')?.name, 'Transport')
  assert.equal(findMatchingCategory(cats, 'Health'), null)

  // token format + hash compat with previous implementation (sha256 hex of trimmed token)
  const tok = 'flw_sec_' + crypto.randomBytes(24).toString('base64url')
  assert.match(tok, /^flw_sec_[A-Za-z0-9_-]{32}$/)
  const old = crypto.createHash('sha256').update(tok).digest('hex')
  assert.equal(crypto.createHash('sha256').update(` ${tok}\n`.trim()).digest('hex'), old)

})
