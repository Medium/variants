// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Public interface exposed to users of 'variants'
 */

var fs = require('fs')
  , path = require('path')


/**
 * Public API. See function declarations for JSDoc.
 */
module.exports = {
    getFlagValue: getFlagValue
    , registerFlag: registerFlag
    , loadFile: loadFile
    , loadJson: loadJson
    , registerConditionType: registerConditionType
}


/**
 * Condition operators for conditional list evaluation.
 * @enum {number}
 */
var Operators = {
    AND: 0
    , OR: 1
}


/**
 * Map of currently registered variants.
 * @type {Object.<Variant>}
 */
var registeredVariants = {}


/**
 * Registered condition specs based on type. Specs create condition functions.
 * @type {Object.<Function>}
 */
var registeredConditionSpecs = {}


/**
 * Maps flags to a set of variant ids. Used to evaluate flag values.
 * @type {Object.<Object>}
 */
var flagToVariantIdsMap = {}


/**
 * Registered variant flags and their default values.
 * @type {Object.<*>}
 */
var defaultValues = {}


// TODO(david): Add optional file watches.


/**
 * Evaluates the flag value based on the given context object.
 * @param {string} flagName Name of the variant flag to get the value for
 * @param {*} defaultValue Default value of the flag.
 */
function registerFlag(flagName, defaultValue) {
  if (flagName in flagToVariantIdsMap || flagName in defaultValues) {
    throw new Error('Variant flag already registered: ' + flagName)
  }
  defaultValues[flagName] = defaultValue
  flagToVariantIdsMap[flagName] = {}
}


/**
 * Evaluates the flag value based on the given context object.
 * @param {string} flagName Name of the variant flag to get the value for
 * @param {Object} context Context object that contains fields relevant to evaluating conditions
 * @return {*} Value specified in the variants JSON file or undefined if no conditions were met
 */
function getFlagValue(flagName, context) {
  var variantIds = flagToVariantIdsMap[flagName]
  if (!variantIds) {
    throw new Error('Variant flag not defined: ' + flagName)
  }

  context = context || {}
  var value = defaultValues[flagName]

  // TODO(david): Partial ordering
  for (var id in variantIds) {
    var v = registeredVariants[id]
    if (!v) {
      throw new Error('Missing registered variant: ' + id)
    }
    if (v.evaluate(context)) {
      value = v.getFlagValue(flagName)
    }
  }
  return value
}


/**
 * Loads the JSON file and registers its variants.
 * @param {string} filepath JSON file to load
 * @param {function (Error=, Object=)} callback optional callback to handle errors
 */
function loadFile(filepath, callback) {
  var text = fs.readFile(filepath, function (err, text) {
    if (err) {
      callbackOrThrow(err, callback)
    }

    try {
      return loadJson(JSON.parse(text), callback)
    } catch (e) {
      callbackOrThrow(e, callback)
    }
  })
}


/**
 * Parses the given JSON object and registers its variants.
 * @param {Object} obj JSON object to parse
 * @param {function (Error=, Object=)} callback optional callback to handle errors
 */
function loadJson(obj, callback) {
  try {
    var variants = parseVariants(getRequired(obj, 'variants'))
    registerVariants(variants)
    if (callback) {
      callback(undefined)
    }
  } catch (e) {
    callbackOrThrow(e, callback)
  }
}


/**
 * Registers the condition type to be used when evaluating variants.
 * @param {string} id Case-insensitive identifier for the condition
 * @param {function(*, Array.<*>)} fn Conditional function generator which takes the
 *     the parsed value and list of values respectively and must return a function that optionally
 *     takes a context Object and returns true or false.
 *     See #registerBuiltInConditionTypes as an example.
 */
function registerConditionType(id, fn) {
  id = id.toUpperCase()
  if (registeredConditionSpecs[id]) {
    throw new Error('Condition already registered: ' + id)
  }
  registeredConditionSpecs[id] = fn
}


/**
 * Fully defines a variant.
 * @param {string} id
 * @param {Operator}
 * @param {Array.<Condition>} conditions
 * @param {Array.<Mod>} mods
 * @constructor
 */
 // TODO(david): Move to separate file.
function Variant(id, operator, conditions, mods) {
  this.id = id
  this.operator = operator
  this.conditions = conditions
  this.mods = mods
}


/**
 * Evaluates the variant in the given context.
 * @param {Object} context Context to evaluate the variant in
 * @return {boolean} evaluation result
 */
Variant.prototype.evaluate = function (context) {
  if (this.operator == Operators.OR) {
    for (var i = 0; i < this.conditions.length; ++i) {
      if (this.conditions[i].evaluate(context)) {
        return true
      }
    }
  } else {
    for (var i = 0; i < this.conditions.length; ++i) {
      if (!this.conditions[i].evaluate(context)) {
        return false
      }
    }
  }
  return true
}


/**
 * Returns the value of a modified flag for this variant.
 * @param {string} flagName name of the flag
 * @param {*} override value
 */
Variant.prototype.getFlagValue = function (flagName) {
  // TODO(david): Use a map instead of searching.
  for (var i = 0; i < this.mods.length; ++i) {
    var m = this.mods[i]
    if (m.flagName === flagName) {
      return m.value
    }
  }

  throw new Error('Flag not found: ' + flagName)
}


/**
 * Condition wrapper.
 * @constructor
 */
function Condition (fn) {
  this.fn = fn
}


/**
 * Evalutes this condition in the context.
 * @param {Object} context
 * @return {boolean}
 */
Condition.prototype.evaluate = function(context) {
  return !!this.fn.call(null, context)
}


/**
 * Defines a modification to a variant flag.
 * @param {string} flagName
 * @param {*} value
 * @constructor
 */
function Mod(flagName, value) {
  this.flagName = flagName
  this.value = value
}


/**
 * Invokes the given callback with the given error if exists, otherwise throws it back.
 * @param {Error} err
 * @param {Function=} callback
 */
function callbackOrThrow(err, callback) {
  if (callback) {
    callback(err)
    return
  }
  throw err
}


/**
 * Registers the supplied list of variants.
 * @param {Array.<Variant>} variants
 */
function registerVariants(variants) {
  // TODO(david): Make this non-destructive.
  for (var i = 0; i < variants.length; ++i) {
    var v = variants[i]
    if (!!registeredVariants[v.id]) {
      throw new Error('Variant already registered with id: ' + v.id)
    }

    for (var j = 0; j < v.mods.length; ++j) {
      var flagName = v.mods[j].flagName

      // Simply place a marker indicating that this flag name maps to the given variant.
      if (!(flagName in flagToVariantIdsMap)) {
        throw new Error('Flag has not been registered: ' + flagName)
      }
      flagToVariantIdsMap[flagName][v.id] = true
    }

    registeredVariants[v.id] = v
  }
}


/**
 * Parses a JSON array into an array of Variants.
 * @param {Array.<Object>} array
 * @return {!Array.<Variant>}
 */
function parseVariants(array) {
  var variants = []
  for (var i = 0; i < array.length; ++i) {
    variants.push(parseVariant(array[i]))
  }
  return variants
}


/**
 * Parses a JSON object into a Variant.
 * @param {Object} obj
 * @return {!Variant}
 */
function parseVariant(obj) {
  var variantId = getRequired(obj, 'id')
  var operator = getOrDefault(obj, 'condition_operator', Operators.AND)
  var conditions = parseConditions(obj['conditions'])
  var mods = parseMods(obj['mods'])
  return new Variant(variantId, operator, conditions, mods)
}


/**
 * Parses a JSON array into an array of Conditions.
 * @param {Array.<Object>} array
 * @return {!Array.<Condition>}
 */
function parseConditions(array) {
  var conditions = []
  for (var i = 0; i < array.length; ++i) {
    conditions.push(parseCondition(array[i]))
  }
  return conditions
}


/**
 * Parses a JSON object into a Condition.
 * @param {Object} obj
 * @param {!Condition}
 */
function parseCondition(obj) {
  var type = getRequired(obj, 'type').toUpperCase()
  var value = getOrDefault(obj, 'value')
  var values = getOrDefault(obj, 'values', [])
  if (!registeredConditionSpecs[type]) {
    throw new Error('Unknown condition type: ' + type)
  }

  var fn = registeredConditionSpecs[type](value, values)
  if (typeof fn !== 'function') {
    throw new Error('Condition function must return a function')
  }
  return new Condition(fn)
}


/**
 * Parses a JSON array into an array of Mods.
 * @param {Array.<Object>} array
 * @return {!Array.<Mod>}
 */
function parseMods(array) {
  var mods = []
  for (var i = 0; i < array.length; ++i) {
    var obj = array[i]
    var flag = getRequired(obj, 'flag')
    var value = getRequired(obj, 'value')
    mods.push(new Mod(flag, value))
  }
  return mods
}


/**
 * Returns the value from the map if it exists or throw an error.
 * @param {Object} obj
 * @param {string} key
 * @return {*} the value if it exists
 */
function getRequired(obj, key) {
  if (key in obj) {
    return obj[key]
  }
  throw new Error('Missing required key "' + key + '" in object: ' + JSON.stringify(obj))
}



/**
 * Returns the value from the map if it exists or the default.
 * @param {Object} obj 
 * @param {string} key
 * @param {*} def Default to return if the key doesn't exist in the object.
 */
function getOrDefault(obj, key, def) {
  if (key in obj) {
    return obj[key]
  }
  return def
}


// Registers built-in condition types.
(function registerBuiltInConditionTypes() {

  // Register the RANDOM condition type.
  registerConditionType ('RANDOM', function (value) {
    if (value < 0 || value > 1) {
      throw new Error('Fractional value from 0-1 required')
    }

    return function() {
      if (!value) {
        return false
      }
      return Math.random() <= value
    }
  })

  // Register the UMOD_RANGE condition type.
  registerConditionType ('MOD_RANGE', function (value, values) {
    if (values.length != 3) {
      throw new Error('Expected two integer range values in "values" array')
    }

    var key = values[0]
    if (typeof key !== 'string') {
      throw new Error('Expected values[0] to be of type string')
    }
    var rangeBegin = values[1]
    var rangeEnd = values[2]
    if (rangeBegin > rangeEnd) {
      throw new Error('Start range must be less than end range')
    }

    return function(context) {
      var v = context[key]
      if (typeof v != 'number') {
        return false
      }
      var mod = v % 100
      return (mod >= rangeBegin && mod <= rangeEnd)
    }
  })
})()
