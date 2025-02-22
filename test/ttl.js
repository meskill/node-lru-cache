if (typeof performance === 'undefined') {
  global.performance = require('perf_hooks').performance
}

const t = require('tap')
const Clock = require('clock-mock')
const clock = new Clock()

const runTests = (LRU, t) => {
  const { setTimeout, clearTimeout } = global
  t.teardown(() => Object.assign(global, { setTimeout, clearTimeout }))
  global.setTimeout = clock.setTimeout.bind(clock)
  global.clearTimeout = clock.clearTimeout.bind(clock)

  t.test('ttl tests defaults', t => {
    // have to advance it 1 so we don't start with 0
    // NB: this module will misbehave if you create an entry at a
    // clock time of 0, for example if you are filling an LRU cache
    // in a node lacking perf_hooks, at midnight UTC on 1970-01-01.
    // This is a known bug that I am ok with.
    clock.advance(1)
    const c = new LRU({ max: 5, ttl: 10, ttlResolution: 0 })
    c.set(1, 1)
    t.equal(c.get(1), 1, '1 get not stale', { now: clock._now })
    clock.advance(5)
    t.equal(c.get(1), 1, '1 get not stale', { now: clock._now })
    t.equal(c.getRemainingTTL(1), 5, '5ms left to live')
    t.equal(c.getRemainingTTL('not in cache'), 0, 'thing doesnt exist')
    clock.advance(5)
    t.equal(c.get(1), 1, '1 get not stale', { now: clock._now })
    t.equal(c.getRemainingTTL(1), 0, 'almost stale')
    clock.advance(1)
    t.equal(c.getRemainingTTL(1), -1, 'gone stale')
    clock.advance(1)
    t.equal(c.getRemainingTTL(1), -2, 'even more stale')
    t.equal(c.has(1), false, '1 has stale', {
      now: clock._now,
      ttls: c.ttls,
      starts: c.starts,
      index: c.keyMap.get(1),
      stale: c.isStale(c.keyMap.get(1)),
    })
    t.equal(c.get(1), undefined)
    t.equal(c.size, 0)

    c.set(2, 2, { ttl: 100 })
    clock.advance(50)
    t.equal(c.has(2), true)
    t.equal(c.get(2), 2)
    clock.advance(51)
    t.equal(c.has(2), false)
    t.equal(c.get(2), undefined)

    c.clear()
    for (let i = 0; i < 9; i++) {
      c.set(i, i)
    }
    // now we have 9 items
    // get an expired item from old set
    clock.advance(11)
    t.equal(c.peek(4), undefined)
    t.equal(c.has(4), false)
    t.equal(c.get(4), undefined)

    // set an item WITHOUT a ttl on it
    c.set('immortal', true, { ttl: 0 })
    clock.advance(100)
    t.equal(c.getRemainingTTL('immortal'), Infinity)
    t.equal(c.get('immortal'), true)
    c.get('immortal', { updateAgeOnGet: true })
    clock.advance(100)
    t.equal(c.get('immortal'), true)
    t.end()
  })

  t.test('ttl tests with ttlResolution=100', t => {
    const c = new LRU({ ttl: 10, ttlResolution: 100, max: 10 })
    c.set(1, 1)
    t.equal(c.get(1), 1, '1 get not stale', { now: clock._now })
    clock.advance(5)
    t.equal(c.get(1), 1, '1 get not stale', { now: clock._now })
    clock.advance(5)
    t.equal(c.get(1), 1, '1 get not stale', { now: clock._now })
    clock.advance(1)
    t.equal(c.has(1), true, '1 has stale', {
      now: clock._now,
      ttls: c.ttls,
      starts: c.starts,
      index: c.keyMap.get(1),
      stale: c.isStale(c.keyMap.get(1)),
    })
    t.equal(c.get(1), 1)
    clock.advance(100)
    t.equal(c.has(1), false, '1 has stale', {
      now: clock._now,
      ttls: c.ttls,
      starts: c.starts,
      index: c.keyMap.get(1),
      stale: c.isStale(c.keyMap.get(1)),
    })
    t.equal(c.get(1), undefined)
    t.equal(c.size, 0)
    t.end()
  })


  t.test('ttl on set, not on cache', t => {
    const c = new LRU({ max: 5, ttlResolution: 0 })
    c.set(1, 1, { ttl: 10 })
    t.equal(c.get(1), 1)
    clock.advance(5)
    t.equal(c.get(1), 1)
    clock.advance(5)
    t.equal(c.get(1), 1)
    clock.advance(1)
    t.equal(c.has(1), false)
    t.equal(c.get(1), undefined)
    t.equal(c.size, 0)

    c.set(2, 2, { ttl: 100 })
    clock.advance(50)
    t.equal(c.has(2), true)
    t.equal(c.get(2), 2)
    clock.advance(51)
    t.equal(c.has(2), false)
    t.equal(c.get(2), undefined)

    c.clear()
    for (let i = 0; i < 9; i++) {
      c.set(i, i, { ttl: 10 })
    }
    // now we have 9 items
    // get an expired item from old set
    clock.advance(11)
    t.equal(c.has(4), false)
    t.equal(c.get(4), undefined)

    t.end()
  })

  t.test('ttl with allowStale', t => {
    const c = new LRU({ max: 5, ttl: 10, allowStale: true, ttlResolution: 0 })
    c.set(1, 1)
    t.equal(c.get(1), 1)
    clock.advance(5)
    t.equal(c.get(1), 1)
    clock.advance(5)
    t.equal(c.get(1), 1)
    clock.advance(1)
    t.equal(c.has(1), false)
    t.equal(c.get(1), 1)
    t.equal(c.get(1), undefined)
    t.equal(c.size, 0)

    c.set(2, 2, { ttl: 100 })
    clock.advance(50)
    t.equal(c.has(2), true)
    t.equal(c.get(2), 2)
    clock.advance(51)
    t.equal(c.has(2), false)
    t.equal(c.get(2), 2)
    t.equal(c.get(2), undefined)

    c.clear()
    for (let i = 0; i < 9; i++) {
      c.set(i, i)
    }
    // now we have 9 items
    // get an expired item from old set
    clock.advance(11)
    t.equal(c.has(4), false)
    t.equal(c.get(4), 4)
    t.equal(c.get(4), undefined)

    t.end()
  })

  t.end()
}

t.test('tests with perf_hooks.performance.now()', t => {
  const { performance } = global
  t.teardown(() => global.performance = performance)
  global.performance = clock
  const LRU = t.mock('../')
  runTests(LRU, t)
})

t.test('tests using Date.now()', t => {
  const { performance, Date } = global
  t.teardown(() => Object.assign(global, { performance, Date }))
  global.Date = clock.Date
  global.performance = null
  const LRU = t.mock('../')
  runTests(LRU, t)
})
