// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Defines the variant Flag class and its base value. A variant flag is a
 * global flag that may changes on a contextual basis based on the variants that refer to it.
 */


module.exports = Flag


/**
 * Defines a variant flag.
 * @param {string} name
 * @param {*} value
 * @constructor
 */
function Flag(name, baseValue) {
  this.name = name
  this.baseValue = baseValue
}


/**
 * Returns the flag's name
 * @return {string}
 */
Flag.prototype.getName = function () {
  return this.name
}


/**
 * Returns the flag's base value
 * @return {*}
 */
Flag.prototype.getBaseValue = function () {
  return this.baseValue
}
