// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Defines the Mod class.
 */


module.exports = Mod


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
 * Returns the mod's flag name.
 * @return {string}
 */
Mod.prototype.getFlagName = function () {
  return this.flagName
}


/**
 * Returns the mod's override value.
 * @return {*}
 */
Mod.prototype.getValue = function () {
  return this.value
}
