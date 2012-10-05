// Copyright 2012 The Obvious Corporation.

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
    clearAll: clearAll
  , getFlagValue: getFlagValue
  , getAllVariants: getAllVariants
  , getAllFlags: getAllFlags
  , loadFile: loadFile
  , loadFileSync: loadFileSync
  , loadJson: loadJson
  , reloadFile: reloadFile
  , reloadJson: reloadJson
  , registerConditionType: registerConditionType
  , registerFlag: registerUserFlag
  , getRegistryNames: getRegistryNames
  , currentRegistry: currentRegistry
  , setCurrentRegistry: setCurrentRegistry
}

/**
 * A map that contains all registries that have been created.
 * @type {Object.<Registry>}
 */
var registryList = {}

/**
 * Global registry object that contains the current set of flags, conditions and variants.
 * @type {Registry}
 */
var globalRegistry = null


// Call 'clearAll' in order to set ourselves to the initial state, with a single main registry.
clearAll()


/**
 * Registry class that contains a set of registered flags, variants and conditions.
 */
function Registry(name) {
  if (!!registryList[name]) throw new Error('A registry with the name ' + name + ' already exists.')

  /**
   * Map of currently registered variants.
   * @type {Object.<Variant>}
   */
  this.variants = {}


  /**
   * Registered condition specs based on type. Specs create condition functions.
   * @type {Object.<Function>}
   */
  this.conditionSpecs = {}


  /**
   * Registered variant flags.
   * @type {Object.<Flag>}
   */
  this.flags = {}


  /**
   * Maps flags to a set of variant ids. Used to evaluate flag values.
   * @type {Object.<Object>}
   */
  this.flagToVariantIdsMap = {}

  /**
   * @type {string}
   */
  this.name = name


  registryList[name] = this
}


/**
 * Registers a new flag.
 * @param {!Flag} flag
 */
Registry.prototype.addFlag = function(flag) {
  var name = flag.getName()
  if (name in this.flags) {
    throw new Error('Variant flag already registered: ' + name)
  }
  this.flags[name] = flag
  this.flagToVariantIdsMap[name] = {}
}


/**
 * Registers a new variant.
 * @param {!Variant} variant
 */
Registry.prototype.addVariant = function(variant) {
  if (!!this.variants[variant.id]) {
    throw new Error('Variant already registered with id: ' + variant.id)
  }

  Registry._mapVariantFlags(variant, this.flags, this.flagToVariantIdsMap)
  this.variants[variant.id] = variant
}


/**
 * Maps flags to a map of variant ids. Useful for quickly looking up which variants
 * belong to a particular flag.
 * @param {!Variant} variant variant to map flags for
 * @param {!Object.<Flag>} flags map of flags
 * @param {!Object.<Object.<string>>} flagToVariantIdsMap
 */
 Registry._mapVariantFlags = function(variant, flags, flagToVariantIdsMap) {
  for (var i = 0; i < variant.mods.length; ++i) {
    var flagName = variant.mods[i].flagName

    // Simply place a marker indicating that this flag name maps to the given variant.
    if (!(flagName in flags)) {
      throw new Error('Flag has not been registered: ' + flagName)
    }
    if (!flagToVariantIdsMap[flagName]) {
      flagToVariantIdsMap[flagName] = {}
    }
    flagToVariantIdsMap[flagName][variant.id] = true
  }
}


/**
 * Overrides the registry with the given registry. Will not stomp old variants or flags unless
 * specified in the new registry. If there is a failure, the registry will not be changed and
 * the old values will persist.
 * @param {!Registry} registry overrides
 */
Registry.prototype.overrideFlagsAndVariants = function (registry) {
  // Copy old and new into temporaries to make sure there are no errors.
  var newFlags = shallowExtend(this.flags, registry.flags)
  var newVariants = shallowExtend(this.variants, registry.variants)

  var newFlagToVariantIdsMap = {}
  for (var k in newVariants) {
    var v = newVariants[k]
    Registry._mapVariantFlags(v, newFlags, newFlagToVariantIdsMap)
  }

  // By this point there was no error, so make the changes.
  this.flags = newFlags
  this.variants = newVariants
  this.flagToVariantIdsMap = newFlagToVariantIdsMap
}


/**
 * Clears all variants and flags.
 */
function clearAll() {
  registryList = {}
  globalRegistry = null
  setCurrentRegistry('main')
}


/**
 * Returns all of the registered variants.
 * @return {Array.<Variant>}
 */
function getAllVariants() {
  var variants = []
  for (var k in globalRegistry.variants) {
    variants.push(globalRegistry.variants[k])
  }
  return variants
}


/**
 * Returns all of the registered flags.
 * @return {Array.<string>}
 */
function getAllFlags() {
  var flags = []
  for (var flag in globalRegistry.flagToVariantIdsMap) {
    flags.push(flag)
  }
  return flags
}


/**
 * Evaluates the flag value based on the given context object.
 * @param {string} flagName Name of the variant flag to get the value for
 * @param {Object=} opt_context Optional context object that contains fields relevant to
 *     evaluating conditions
 * @param {Object.<boolean>=} opt_forced Optional map of variant ids that are forced
 *     to either true or false.
 * @return {*} Value specified in the variants JSON file or undefined if no conditions were met
 */
function getFlagValue(flagName, context, opt_forced) {
  var variantIds = globalRegistry.flagToVariantIdsMap[flagName]
  if (!variantIds) {
    throw new Error('Variant flag not defined: ' + flagName)
  }

  context = context || {}
  var forced = opt_forced || {}
  var value = globalRegistry.flags[flagName].getBaseValue()

  // TODO(david): Partial ordering
  for (var id in variantIds) {
    var v = globalRegistry.variants[id]
    if (!v) {
      throw new Error('Missing registered variant: ' + id)
    }

    var forcedOn = forced[id] === true
    var forcedOff = forced[id] === false
    if (!forcedOff && (forcedOn || v.evaluate(context))) {
      value = v.getFlagValue(flagName)
    }
  }
  return value
}


/**
 * Loads the JSON file and registers its variants.
 * @param {string} filepath JSON file to load
 * @param {function (Error=)} callback invoked when done
 * @param {Registry=} opt_registry optional registry
 */
function loadFile(filepath, callback, opt_registry) {
  // Keep a copy of the registry that was active when the call was
  // initiated, so that we load the JSON into the correct registry
  // even if the registry gets switched out before the readFile completes.
  var registry = opt_registry || globalRegistry

  fs.readFile(filepath, function (err, text) {
    if (err) return callback(err)

    loadJson(JSON.parse(text), function (err) {
      callback(err)
    }, registry)
  })
}


/**
 * Loads the JSON file synchronously and registers its variants.
 * @param {string} filepath JSON file to load
 * @param {Registry=} opt_registry optional registry
 */
function loadFileSync(filepath, opt_registry) {
  var registry = opt_registry || globalRegistry
  var text = fs.readFileSync(filepath, 'utf8')
  return loadJson(JSON.parse(text), function (err) {
    if (err) throw err
  }, registry)
}


/**
 * Parses the given JSON object and registers its variants.
 * @param {Object} obj JSON object to parse
 * @param {function (Error=)} callback invoked when done.
 * @param {Registry=} opt_registry optional registry
 */
function loadJson(obj, callback, opt_registry) {
  var registry = opt_registry || globalRegistry
  var err
  try {
    var flags = obj['flag_defs'] ? parseFlags(obj['flag_defs']) : []
    for (var i = 0; i < flags.length; ++i) {
      registry.addFlag(flags[i])
    }

    var variants = obj['variants'] ? parseVariants(obj['variants']) : []
    for (var i = 0; i < variants.length; ++i) {
      registry.addVariant(variants[i])
    }
  } catch (e) {
    err = e
  }
  callback(err)
}


/**
 * Reloads the JSON file and overrides currently registered variants.
 * @param {string} filepath JSON file to load
 * @param {function (Error=, Object=)} callback optional callback to handle errors
 */
function reloadFile(filepath, callback) {
  var reloaded = new Registry()
  loadFile(filepath, function (err) {
    if (err) return callback(err)
    globalRegistry.overrideFlagsAndVariants(reloaded)
    callback()
  }, reloaded)
}


/**
 * Reloads the given JSON object and registers its variants.
 * @param {Object} obj JSON object to parse
 * @param {function (Error=, Object=)} callback optional callback to handle errors
 */
function reloadJson(obj, callback) {
  var reloaded = new Registry()
  loadJson(obj, callback, reloaded)
  globalRegistry.overrideFlagsAndVariants(reloaded)
}


/**
 * Creates a new flag object and registers it.
 * @param {string} flagName Name of the variant flag
 * @param {*} defaultValue
 */
function registerUserFlag(flagName, defaultValue) {
  return globalRegistry.addFlag(new Flag(flagName, defaultValue))
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
  if (globalRegistry.conditionSpecs[id]) {
    throw new Error('Condition already registered: ' + id)
  }
  globalRegistry.conditionSpecs[id] = fn
}


/**
 * Gets an array of all the names of the registries that have already been created.
 * @return {Array.<string>}
 */
function getRegistryNames() {
  return Object.keys(registryList)
}


/**
 * Gets the name of the registry that is currently being used.
 * @return {string}
 */
function currentRegistry() {
  return globalRegistry.name
}


/**
 * Switches to the named registry. If a registry by that name does not exist, it
 * is created.
 * @return {string}
 */
function setCurrentRegistry(name) {
  if (!globalRegistry || globalRegistry.name != name) {
    if (registryList[name]) {
      globalRegistry = registryList[name]
    } else {
      globalRegistry = new Registry(name)
      registerBuiltInConditionTypes()
    }
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
  var operator = getOrDefault(obj, 'condition_operator', null)
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

  if (!globalRegistry.conditionSpecs[type]) {
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
  var fn = globalRegistry.conditionSpecs[type](input)
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


/**
 * Creates a superset of all of the passed in objects, overriding individual key/value pairs
 * for each subsequent duplicate (therefore order dependent). Returns the new object.
 * @param {Object...} arguments
 * @return {!Object}
 */
function shallowExtend() {
  var to = {}
  for (var i = 0; i < arguments.length; ++i) {
    var from = arguments[i]
    for (var k in from) {
      to[k] = from[k]
    }
  }
  return to
}


// Registers built-in condition types.
function registerBuiltInConditionTypes() {
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
}
