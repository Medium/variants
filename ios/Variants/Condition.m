//
//  Condition.m
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import "Condition.h"

@implementation Condition

- (instancetype)initWithEvaluationBlock:(ConditionEvaluator)block {
  self = [super init];
  if (self) {
    _evaluationBlock = [^BOOL(id<NSCopying> outerContext) {
        return block([outerContext copyWithZone:NULL]);
    } copy];
  }
  return self;
}

@end
