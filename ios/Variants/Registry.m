//
//  Registry.m
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import "Registry.h"

#import "Condition.h"
#import "Flag.h"
#import "Mod.h"
#import "Variant.h"

@interface Registry ()
- (void)_registerBuiltInConditionTypes;
- (Variant *)_variantFromDictionary:(NSDictionary *)dictionary;

@property(nonatomic, strong) NSMutableDictionary *variantIdToVariant;
@property(nonatomic, strong) NSMutableDictionary *conditionTypeToSpecBlock;
@property(nonatomic, strong) NSMutableDictionary *flagNameToFlag;
@property(nonatomic, strong) NSMutableDictionary *flagNameToVariantIdSet;
@end

@implementation Registry

static dispatch_once_t onceToken;
static Registry *_sharedRegistry = nil;

+ (instancetype)sharedRegistry {
  dispatch_once(&onceToken, ^{ _sharedRegistry = [[Registry alloc] init]; });
  return _sharedRegistry;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    _variantIdToVariant = [NSMutableDictionary dictionary];
    _conditionTypeToSpecBlock = [NSMutableDictionary dictionary];
    _flagNameToFlag = [NSMutableDictionary dictionary];
    _flagNameToVariantIdSet = [NSMutableDictionary dictionary];

    [self _registerBuiltInConditionTypes];
  }
  return self;
}

- (void)addFlag:(Flag *)flag {
  if (self.flagNameToFlag[flag.name]) {
    [NSException
         raise:@"Flag has already been added"
        format:@"A Flag with the name %@ has already been added", flag.name];
  }
  self.flagNameToFlag[flag.name] = flag;
  self.flagNameToVariantIdSet[flag.name] = [NSMutableSet set];
}

- (id)flagValueWithName:(NSString *)name {
  return [self flagValueWithName:name context:nil];
}

- (id)flagValueWithName:(NSString *)name context:(id<NSCopying>)context {
  id value = [(Flag *)self.flagNameToFlag[name] baseValue];
  for (NSString *variantId in self.flagNameToVariantIdSet[name]) {
    Variant *v = self.variantIdToVariant[variantId];
    if ([v evaluateWithContext:context]) {
      value = [v valueForFlagWithName:name];
    }
  }
  return value;
}

- (NSArray *)allFlags {
  return [self.flagNameToFlag allKeys];
}

- (void)addVariant:(Variant *)variant {
  if (self.variantIdToVariant[variant.identifier]) {
    [NSException raise:@"Variant has already been added"
                format:@"A Variant with the idenfier %@ has already been added",
                       variant.identifier];
  }
  for (Mod *m in variant.mods) {
    if (![self.flagNameToFlag.allKeys containsObject:m.flagName]) {
      [NSException raise:@"Variant has unknown flag"
                  format:@"Variant with the idenfier %@ has unknown flag %@",
                         variant.identifier, m.flagName];
    }
    [self.flagNameToVariantIdSet[m.flagName] addObject:variant.identifier];
  }
  self.variantIdToVariant[variant.identifier] = variant;
}

- (NSArray *)allVariants {
  return [self.variantIdToVariant allValues];
}

- (void)registerConditionTypeWithId:(NSString *)identifier
                          specBlock:(ConditionSpec)specBlock {
  identifier = [identifier uppercaseString];
  if (self.conditionTypeToSpecBlock[identifier]) {
    [NSException
         raise:@"Condition has already been registered"
        format:@"A Condition with identifier %@ has already been registered",
               identifier];
  }
  self.conditionTypeToSpecBlock[identifier] = specBlock;
}

- (void)loadConfigFromData:(NSData *)data error:(NSError **)error {
  NSDictionary *config =
      [NSJSONSerialization JSONObjectWithData:data options:0 error:error];
  if (!config) {
    return;
  }
  [self loadConfigFromDictionary:config];
}

- (void)loadConfigFromDictionary:(NSDictionary *)dictionary {
  for (NSDictionary *d in dictionary[@"flag_defs"]) {
    [self addFlag:[Flag flagFromDictionary:d]];
  }
  for (NSDictionary *d in dictionary[@"variants"]) {
    [self addVariant:[self _variantFromDictionary:d]];
  }
}

#pragma mark - Private methods

- (void)_registerBuiltInConditionTypes {
  srand48(time(0));
  ConditionSpec randomSpec = ^ConditionEvaluator(id<NSCopying> value) {
      if (![(NSObject *)value isKindOfClass:[NSNumber class]] ||
          [(NSNumber *)value doubleValue] < 0 ||
          [(NSNumber *)value doubleValue] > 1) {
        [NSException
             raise:@"Invalid argument to RANDOM condition type"
            format:@"The value %@ must be an NSNumber between 0-1", value];
      }
      return ^BOOL(id<NSCopying> context) {
          return drand48() <= [(NSNumber *)value doubleValue];
      };
  };
  [self registerConditionTypeWithId:@"RANDOM" specBlock:randomSpec];

  ConditionSpec rangeSpec = ^ConditionEvaluator(id<NSCopying> value) {
      NSArray *values = (NSArray *)value;
      if (!values || values.count != 3) {
        [NSException
             raise:@"Invalid argument to MOD_RANGE condition type"
            format:@"Expected array with key and and two integer range values"];
      }
      if (![values[0] isKindOfClass:[NSString class]]) {
        [NSException raise:@"Invalid argument to MOD_RANGE condition type"
                    format:@"The first value %@ must be a string", values[0]];
      }
      NSString *key = (NSString *)values[0];
      if (![values[1] isKindOfClass:[NSNumber class]]) {
        [NSException raise:@"Invalid argument to MOD_RANGE condition type"
                    format:@"The second value %@ must be a number", values[1]];
      }
      NSNumber *rangeBegin = (NSNumber *)values[1];

      if (![values[2] isKindOfClass:[NSNumber class]]) {
        [NSException raise:@"Invalid argument to MOD_RANGE condition type"
                    format:@"The third value %@ must be a number", values[2]];
      }
      NSNumber *rangeEnd = (NSNumber *)values[2];

      if ([rangeBegin doubleValue] > [rangeEnd doubleValue]) {
        [NSException raise:@"Invalid argument to MOD_RANGE condition type"
                    format:@"Start range %@ must be less than end range %@",
                           rangeBegin, rangeEnd];
      }
      return ^BOOL(id<NSCopying> context) {
          if (![(NSObject *)context isKindOfClass:[NSDictionary class]]) {
            return NO;
          }
          id val = ((NSDictionary *)context)[key];
          if (![val isKindOfClass:[NSNumber class]]) {
            return NO;
          }
          NSInteger mod = [(NSNumber *)val integerValue] % 100;
          return mod >= rangeBegin.integerValue && mod <= rangeEnd.integerValue;
      };
  };
  [self registerConditionTypeWithId:@"MOD_RANGE" specBlock:rangeSpec];
}

- (Variant *)_variantFromDictionary:(NSDictionary *)dictionary {
  NSMutableArray *conditions = [NSMutableArray array];
  for (NSDictionary *d in dictionary[@"conditions"]) {
    NSString *type = [d[@"type"] uppercaseString];
    ConditionSpec spec = self.conditionTypeToSpecBlock[type];
    if (!spec) {
      [NSException
           raise:@"Unregistered condition type"
          format:@"The condition type %@ has not been registered", type];
    }
    id<NSCopying> value = d[@"value"];
    NSArray *values = d[@"values"];
    if (value && values) {
      [NSException
           raise:@"Invalid Variant specification"
          format:@"Cannot specify both a value and array of values for %@",
                 type];
    }
    ConditionEvaluator evaluator = value ? spec(value) : spec(values);
    [conditions
        addObject:[[Condition alloc] initWithEvaluationBlock:evaluator]];
  }
  NSMutableArray *mods = [NSMutableArray array];
  for (NSDictionary *d in dictionary[@"mods"]) {
    [mods addObject:[Mod modFromDictionary:d]];
  }
  return [[Variant alloc] initWithIdentifier:dictionary[@"id"]
                                          op:dictionary[@"condition_operator"]
                                  conditions:conditions
                                        mods:mods];
}

#pragma mark - Test helpers

+ (void)_setSharedRegistry:(Registry *)registry {
  if (registry == nil) {
    onceToken = 0;
  }
  _sharedRegistry = registry;
}

@end
