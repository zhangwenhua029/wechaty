import { test } from 'ava'

/* tslint:disable:no-var-requires */
const retryPromise = require('retry-promise').default

import {
  log
} from '../../'

import {
  PuppetWeb
  , Watchdog
} from '../../src/puppet-web/'

const PROFILE = 'unit-test-session.wechaty.json'

test('Puppet Web watchdog timer', async t => {
  const pw = new PuppetWeb({profile: PROFILE})
  t.truthy(pw, 'should instantiate a PuppetWeb')

  try {
    pw.addListener('error', failOnUnexpectedErrorEvent)

    Watchdog.onFeed.call(pw, { data: 'initing directly' })
    t.pass('should ok with default food type')

    const origLogLevel = log.level()
    if (log.level() === 'info') {
      log.level('silent')
      t.pass('set log.level = silent to mute log when watchDog reset wechaty temporary')
    }

    await pw.init()
    await pw.quit()

    {
      pw.removeListener('error', failOnUnexpectedErrorEvent)

      let errorCounter = 0
      pw.once('error', e => errorCounter++)
      pw.emit('watchdog', {
        data: 'active_for_timeout_1ms'
        , timeout: 1
      })
      await new Promise(resolve => setTimeout(resolve, 10)) // wait untill reset
      t.is(errorCounter, 1, 'should get event[error] after watchdog timeout')

      pw.addListener('error', failOnUnexpectedErrorEvent)
    }

    // pw.once('error', e => t.fail('waitDing() triggered watchDogReset()'))

    const EXPECTED_DING_DATA = 'dingdong'
    pw.emit('watchdog', { data: 'feed to extend the dog life', timeout: 120000 })

    const dong = await waitDing(EXPECTED_DING_DATA)
    t.is(dong, EXPECTED_DING_DATA, 'should get EXPECTED_DING_DATA from ding after watchdog reset, and restored log level')

    log.level(origLogLevel)
    await pw.quit()

    return

  } catch (e) {
    t.fail('exception: ' + e.message + ', ' + e.stack)
  }
  /////////////////////////////////////////////////////////////////////////////
  function waitDing(data) {
    const max = 13
    const backoff = 1000

    // max = (2*totalTime/backoff) ^ (1/2)
    // timeout = 11,250 for {max: 15, backoff: 100}
    // timeout = 45,000 for {max: 30, backoff: 100}
    // timeout = 49,000 for {max: 7, backoff: 2000}
    // timeout = 84,500 for {max: 13, backoff: 1000}
    const timeout = max * (backoff * max) / 2

    return retryPromise({max: max, backoff: backoff}, async function(attempt) {
      log.silly('TestPuppetWeb', 'waitDing() retryPromise: attampt %s/%s time for timeout %s'
        , attempt, max, timeout)

      try {
        const r = await pw.ding(data)
        if (!r) {
          throw new Error('got empty return')
        }
        return r
      } catch (e) {
        log.verbose('TestPuppetWeb', 'waitDing() exception: %s', e.message)
        throw e
      }

    })
    .catch(e => {
      log.error('TestPuppetWeb', 'retryPromise() waitDing() finally FAIL: %s', e.message)
      throw e
    })
  }

  function failOnUnexpectedErrorEvent(e: Error) {
    t.fail('should not get unexpected `error` event: ' + e.message + ', ' + e.stack)
  }
})
