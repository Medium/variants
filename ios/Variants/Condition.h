//
//  Condition.h
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef BOOL (^ConditionEvaluator)(id<NSCopying>);
typedef ConditionEvaluator (^ConditionSpec)(id<NSCopying>);

@interface Condition : NSObject

- (instancetype)initWithEvaluationBlock:(ConditionEvaluator)block;

@property(nonatomic, copy, readonly) BOOL (^evaluationBlock)(id<NSCopying>);

@end
