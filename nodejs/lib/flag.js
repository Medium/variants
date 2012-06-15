// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Defines the variant Flag class and its base value.
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
