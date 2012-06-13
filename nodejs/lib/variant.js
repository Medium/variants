// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Defines the Variant class.
 */


var Operators = require('./operators')

module.exports = Variant


/**
 * Fully defines a variant.
 * @param {string} id
 * @param {Operator}
 * @param {Array.<Condition>} conditions
 * @param {Array.<Mod>} mods
 * @constructor
 */
function Variant(id, operator, conditions, mods) {
  this.id = id
  this.operator = operator
  this.conditions = conditions
  this.mods = mods
}


/**
 * Returns the variant id.
 * @return {string}
 */
Variant.prototype.getId = function () {
  return this.id
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
