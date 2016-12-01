//
//  Mod.m
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import "Mod.h"

@implementation Mod

- (instancetype)initWithFlagName:(NSString *)flagName
                           value:(id<NSCopying>)value {
  self = [super init];
  if (self) {
    _flagName = [flagName copy];
    _value = [value copyWithZone:NULL];
  }
  return self;
}

+ (instancetype)modFromDictionary:(NSDictionary *)dictionary {
  return [[Mod alloc] initWithFlagName:dictionary[@"flag"]
                                 value:dictionary[@"value"]];
}

@end
