//
//  Variant.h
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface Variant : NSObject

- (instancetype)initWithIdentifier:(NSString *)identifier
                                op:(NSString *)op
                        conditions:(NSArray *)conditions
                              mods:(NSArray *)mods;

- (id)valueForFlagWithName:(NSString *)name;
- (BOOL)evaluateWithContext:(id<NSCopying>)context;

@property(nonatomic, copy, readonly) NSString *identifier;
@property(nonatomic, copy, readonly) NSString *op;
@property(nonatomic, copy, readonly) NSArray *conditions;
@property(nonatomic, copy, readonly) NSArray *mods;

@end
