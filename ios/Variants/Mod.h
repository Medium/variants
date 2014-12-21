//
//  Mod.h
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface Mod : NSObject

- (instancetype)initWithFlagName:(NSString *)flagName
                           value:(id<NSCopying>)value;

+ (instancetype)modFromDictionary:(NSDictionary *)dictionary;

@property(nonatomic, copy, readonly) NSString *flagName;
@property(nonatomic, copy, readonly) id value;

@end
