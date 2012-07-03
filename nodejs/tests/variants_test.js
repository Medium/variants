// Copyright 2012 The Obvious Corporation.

/**
 * @fileoverview Unit tests for variants lib. Run with `nodeunit variants_test.js`
 */


var nodeunit = require('nodeunit')
    , fs = require('fs')
    , testCase = nodeunit.testCase
    , variants = require('../lib/variants.js')


module.exports = testCase({

  setUp: function (done) {
    variants.clearAll()
    done()
  },

  testErrorConditions: function (test) {
    var json = {
      variants: [{
        id: 'Fail', 
        conditions: [{
            type: 'RANDOM'
          , value: 'foo'
          , values: ['foo']
        }],
        mods: [{
            flag: 'foo'
          , value: 'bar'
        }]
      }]
    }
    var parseError
    variants.loadJson(json, function (err) {
      parseError = !!err
      test.ok(parseError)
      test.done()
    })
  },
  
  testRandom: function (test) {
    variants.loadFile('tests/testdata.json', function (err) {
      test.ok(!err)
      test.ok(variants.getFlagValue('always_passes'))
      test.equals(variants.getFlagValue('always_fails'), false)
      test.done()
    })
  },

  testModRange: function (test) {
    variants.loadFile('tests/testdata.json', function (err) {
      test.ok(!err)
      test.ok(variants.getFlagValue('mod_range', { user_id: 0 }))
      test.ok(variants.getFlagValue('mod_range', { user_id: 3 }))
      test.ok(variants.getFlagValue('mod_range', { user_id: 9 }))
      test.equal(variants.getFlagValue('mod_range', { user_id: 50 }), false)
      test.done()
    })
  },

  testCustomCondition: function (test) {
    variants.registerConditionType('CUSTOM', function(value) {
      return function(context) {
        return context['password'] === value
      }
    })
    variants.loadFile('tests/custom.json', function (err) {
      test.ok(!err)
      test.equal(variants.getFlagValue('custom_value', {}), 0)
      test.equal(variants.getFlagValue('custom_value', { password: 'wrong' }), 0)
      test.equal(variants.getFlagValue('custom_value', { password: 'secret'}), 42)
      test.done()
    })
  },

  testGetFlags: function (test) {
    variants.loadFile('tests/testdata.json', function (err) {
      test.ok(!err)
      var flags = variants.getAllFlags()
      test.ok(contains(flags, 'always_passes'))
      test.ok(contains(flags, 'always_fails'))
      test.ok(contains(flags, 'coin_flip'))
      test.ok(contains(flags, 'mod_range'))
      test.done()
    })
  },

  testGetVariants: function (test) {
    variants.loadFile('tests/testdata.json', function (err) {
      test.ok(!err)
      var list = variants.getAllVariants()
      var variant;
      for (var i = 0; i < list.length; ++i) {
        if (list[i].getId() == 'CoinFlipTest') {
          variant = list[i]
          break
        }
      }
      test.ok(!!variant)
      test.done()
    })
  },

  testForcing: function (test) {
    variants.loadFile('tests/testdata.json', function (err) {
      test.ok(!err)
      test.ok(variants.getFlagValue('always_passes'))
      test.equals(variants.getFlagValue('always_fails'), false)
      var forced = {
          AlwaysPassesTest: false
        , AlwaysFailsTest: true
      }
      test.ok(variants.getFlagValue('always_fails', undefined, forced))
      test.equals(variants.getFlagValue('always_passes', undefined, forced), false)
      test.done()
    })
  },

  testReloadVariants: function (test) {
    variants.loadFile('tests/testdata.json', function (err) {
      test.ok(!err)
      test.ok(variants.getFlagValue('always_passes'))
      test.ok(!variants.getFlagValue('always_fails'))

      // Reload the new test data with changed values.
      variants.reloadFile('tests/testdata_reloaded.json', function (err) {
        test.ok(!err)
        test.ok(variants.getFlagValue('always_passes'))
        test.ok(variants.getFlagValue('always_fails'))
        test.ok(variants.getFlagValue('coin_flip'))
        test.ok(variants.getFlagValue('mod_range'))
        test.done()
      })
    })
  }
})


function contains(list, value) {
  for (var i = 0; i < list.length; ++i) {
    if (list[i] === value) {
      return true
    }
  }
  return false
}
