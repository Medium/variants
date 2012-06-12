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
    test.ok(variants.getFlagValue('always_true'))
    test.ok(!variants.getFlagValue('always_false'))
    test.done()
  }

  , testModRange: function (test) {
    test.ok(variants.getFlagValue('mod_range', { user_id: 0 }))
    test.ok(variants.getFlagValue('mod_range', { user_id: 3 }))
    test.ok(variants.getFlagValue('mod_range', { user_id: 9 }))
    test.equal(variants.getFlagValue('mod_range', { user_id: 50 }), undefined)
    test.done()
  }

  , testCustomCondition: function (test) {
    variants.registerConditionType('CUSTOM', function(value) {
      return function(context) {
        return context['password'] === value
      }
    })
    loadTestData('./custom.json')
    test.equal(variants.getFlagValue('custom_value', {}), undefined)
    test.equal(variants.getFlagValue('custom_value', { password: 'wrong' }), undefined)
    test.equal(variants.getFlagValue('custom_value', { password: 'secret'}), 42)
    test.done()
  }
})


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

loadTestData('./testdata.json')
