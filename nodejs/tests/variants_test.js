// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Unit tests for variants lib. Run with `nodeunit variants_test.js`
 */


var nodeunit = require('nodeunit')
    , fs = require('fs')
    , testCase = nodeunit.testCase
    , variants = require('../lib/variants.js')


module.exports = testCase({
  
  testRandom: function (test) {
    test.ok(variants.getFlagValue('always_passes'))
    test.equals(variants.getFlagValue('always_fails'), false)
    test.done()
  }

  , testModRange: function (test) {
    test.ok(variants.getFlagValue('mod_range', { user_id: 0 }))
    test.ok(variants.getFlagValue('mod_range', { user_id: 3 }))
    test.ok(variants.getFlagValue('mod_range', { user_id: 9 }))
    test.equal(variants.getFlagValue('mod_range', { user_id: 50 }), false)
    test.done()
  }

  , testCustomCondition: function (test) {
    variants.registerFlag('custom_value', 0)
    variants.registerConditionType('CUSTOM', function(value) {
      return function(context) {
        return context['password'] === value
      }
    })
    loadTestData('./custom.json')
    test.equal(variants.getFlagValue('custom_value', {}), 0)
    test.equal(variants.getFlagValue('custom_value', { password: 'wrong' }), 0)
    test.equal(variants.getFlagValue('custom_value', { password: 'secret'}), 42)
    test.done()
  }

  , testGetFlags: function (test) {
    var flags = variants.getAllFlags()
    test.ok(contains(flags, 'always_passes'))
    test.ok(contains(flags, 'always_fails'))
    test.ok(contains(flags, 'coin_flip'))
    test.ok(contains(flags, 'mod_range'))
    test.done()
  }

  , testGetVariants: function (test) {
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


/**
 * Synchronously loads test data into memory for tests.
 */
function loadTestData(file) {
  // Hack to synchronously load the file.
  var readFile = fs.readFile
  fs.readFile = function (file, callback) {
    var text = fs.readFileSync(file)
    callback(undefined, text)
  }

  variants.loadFile(file)
  fs.readFile = readFile
}

variants.registerFlag('always_passes', false)
variants.registerFlag('always_fails', false)
variants.registerFlag('coin_flip', false)
variants.registerFlag('mod_range', false)
loadTestData('./testdata.json')
