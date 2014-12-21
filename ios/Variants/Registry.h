//
//  Registry.h
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "Condition.h"

@class Flag;
@class Variant;

@interface Registry : NSObject

+ (instancetype)sharedRegistry;
- (void)addFlag:(Flag *)flag;
- (id)flagValueWithName:(NSString *)name;
- (id)flagValueWithName:(NSString *)name context:(id<NSCopying>)context;
- (NSArray *)allFlags;
- (void)addVariant:(Variant *)variant;
- (NSArray *)allVariants;
- (void)registerConditionTypeWithId:(NSString *)identifier
                          specBlock:(ConditionSpec)specBlock;
- (void)loadConfigFromData:(NSData *)data error:(NSError **)error;
- (void)loadConfigFromDictionary:(NSDictionary *)dictionary;
@end
