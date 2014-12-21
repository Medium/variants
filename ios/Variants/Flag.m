//
//  Flag.m
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import "Flag.h"

@implementation Flag

- (instancetype)initWithName:(NSString *)name
                 description:(NSString *)description
                   baseValue:(id<NSCopying>)baseValue {
  self = [super init];
  if (self) {
    _name = [name copy];
    _flagDescription = [description copy];
    _baseValue = [baseValue copyWithZone:NULL];
  }
  return self;
}

+ (instancetype)flagFromDictionary:(NSDictionary *)dictionary {
  return [[Flag alloc] initWithName:dictionary[@"flag"]
                        description:dictionary[@"desc"]
                          baseValue:dictionary[@"base_value"]];
}

@end
