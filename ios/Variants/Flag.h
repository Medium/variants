//
//  Flag.h
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface Flag : NSObject

- (instancetype)initWithName:(NSString *)name
                 description:(NSString *)description
                   baseValue:(id<NSCopying>)baseValue;

+ (instancetype)flagFromDictionary:(NSDictionary *)dictionary;

@property(nonatomic, copy, readonly) NSString *name;
@property(nonatomic, copy, readonly) NSString *flagDescription;
@property(nonatomic, copy, readonly) id baseValue;

@end
