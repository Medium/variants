//
//  Variant.m
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import "Variant.h"

#import "Condition.h"
#import "Mod.h"

NSString *const VariantOperatorAND = @"AND";
NSString *const VariantOperatorOR = @"OR";

@implementation Variant

- (instancetype)initWithIdentifier:(NSString *)identifier
                                op:(NSString *)op
                        conditions:(NSArray *)conditions
                              mods:(NSArray *)mods {
  self = [super init];
  if (self) {
    if ((op && conditions.count < 2) || (!op && conditions.count >= 2)) {
      [NSException raise:@"Invalid arguments to Variant initializer"
                  format:op ? @"Cannot have a Variant operator "
                             @"without multiple conditions"
                            : @"Cannot have multiple variant "
                             @"conditions without an operator"];
    }
    if (op && (![op isEqualToString:VariantOperatorAND] &&
               ![op isEqualToString:VariantOperatorOR])) {
      [NSException
           raise:@"Invalid operator passed to Variant initializer"
          format:@"Expected operator to be \"AND\" or \"OR\", got \"%@\"", op];
    }

    _identifier = [identifier copy];
    _op = [op copy];
    _conditions = [conditions copy];
    _mods = [mods copy];
  }
  return self;
}

- (id)valueForFlagWithName:(NSString *)name {
  for (Mod *m in self.mods) {
    if ([m.flagName isEqualToString:name]) {
      return m.value;
    }
  }
  return nil;
}

- (BOOL)evaluateWithContext:(id<NSCopying>)context {
  if ([self.op isEqualToString:VariantOperatorOR]) {
    for (Condition *c in self.conditions) {
      if (c.evaluationBlock(context)) {
        return YES;
      }
    }
    return NO;
  } else if (self.conditions.count <= 1 ||
             [self.op isEqualToString:VariantOperatorAND]) {
    for (Condition *c in self.conditions) {
      if (!c.evaluationBlock(context)) {
        return NO;
      }
    }
    return YES;
  }
  return NO;
}

@end
