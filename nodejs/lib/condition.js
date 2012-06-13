// Copyright (c)2012 The Obvious Corporation

/**
 * @fileoverview Defines the Condition class.
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
