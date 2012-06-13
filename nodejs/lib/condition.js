// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Defines the Condition class. Conditions wrap user defined methods that
 * evaluate with user-defined context object. A condition must evaluate to true or false and is
 * used by variants to determine whether or not the variant is "Active"
 */


module.exports = Condition


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
