// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Public interface exposed to users of 'variants'
 */

var fs = require('fs')
  , path = require('path')
  , Variant = require('./variant')
  , Condition = require('./condition')
  , Mod = require('./mod')
  , Flag = require('./flag')
  , Operators = require('./operators')


/**
 * Public API. See function declarations for JSDoc.
 */
module.exports = {
    getFlagValue: getFlagValue
  , getAllVariants: getAllVariants
  , getAllFlags: getAllFlags
  , loadFile: loadFile
  , loadJson: loadJson
  , registerConditionType: registerConditionType
  , registerFlag: registerUserFlag
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
 * Registered variant flags.
 * @type {Object.<Flag>}
 */
var registeredFlags = {}


/**
 * Maps flags to a set of variant ids. Used to evaluate flag values.
 * @type {Object.<Object>}
 */
var flagToVariantIdsMap = {}


// TODO(david): Add optional file watches.


/**
 * Returns all of the registered variants.
 * @return {Array.<Variant>}
 */
function getAllVariants() {
  var variants = []
  for (var k in registeredVariants) {
    variants.push(registeredVariants[k])
  }
  return variants
}


/**
 * Returns all of the registered flags.
 * @return {string}
 */
function getAllFlags() {
  var flags = []
  for (var flag in flagToVariantIdsMap) {
    flags.push(flag)
  }
  return flags
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
  var value = registeredFlags[flagName].getBaseValue()

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
    var flags = obj['flag_defs'] ? parseFlags(obj['flag_defs']) : []
    for (var i = 0; i < flags.length; ++i) {
      registerFlag(flags[i])
    }

    var variants = obj['variants'] ? parseVariants(obj['variants']) : []
    registerVariants(variants)
    if (callback) {
      callback(undefined)
    }
  } catch (e) {
    callbackOrThrow(e, callback)
  }
}


/**
 * Creates a new flag object and registers it.
 * @param {string} flagName Name of the variant flag
 * @param {*} defaultValue
 */
function registerUserFlag(flagName, defaultValue) {
  return registerFlag(new Flag(flagName, defaultValue))
}


/**
 * Registers a flag.
 * @param {Flag} flag
 */
function registerFlag(flag) {
  var name = flag.getName()
  if (name in flagToVariantIdsMap || name in registeredFlags) {
    throw new Error('Variant flag already registered: ' + name)
  }
  registeredFlags[name] = flag
  flagToVariantIdsMap[name] = {}
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
 * Registers a list of flags.
 */
function registerFlags(flags) {
  for (var i = 0; i < flags.length; ++i) {
    registerFlag(f[i])
  }
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
 * Parses a JSON array into an array of Flags.
 * @param {Array.<Object>} array
 * @return {!Array.<Variant>}
 */
function parseFlags(array) {
  var flags = []
  for (var i = 0; i < array.length; ++i) {
    var f = parseFlag(array[i])
    flags.push(f)
  }
  return flags
}


/**
 * Parses a JSON object into a Flag.
 * @param {Object} obj
 * @return {!Variant}
 */
function parseFlag(obj) {
  var id = getRequired(obj, 'flag')
  var baseValue = getRequired(obj, 'base_value')
  return new Flag(id, baseValue)
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
  var conditions = !!obj['conditions'] ? parseConditions(obj['conditions']) : []
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
  if (!registeredConditionSpecs[type]) {
    throw new Error('Unknown condition type: ' + type)
  }

  var value = getOrDefault(obj, 'value', null)
  var values = getOrDefault(obj, 'values', null)
  if (value != null && values != null) {
    throw new Error('Cannot specify both a value and array of values for: ' + type)
  }

  // Only pass in either value, values or null.
  if (value == null && values == null) {
    value = null
  }
  var input = (values != null) ? values : value
  var fn = registeredConditionSpecs[type](input)
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
  registerConditionType('RANDOM', function (value) {
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
  registerConditionType('MOD_RANGE', function (values) {
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
