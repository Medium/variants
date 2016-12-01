//
//  RegistryTest.m
//  Variants
//
//  Created by Andrew Bonventre on 12/18/14.
//  Copyright (c) 2014 Andrew Bonventre. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <XCTest/XCTest.h>

#import "Condition.h"
#import "Flag.h"
#import "Mod.h"
#import "Registry.h"
#import "Registry+Testing.h"
#import "Variant.h"

@interface VariantsRegistryTest : XCTestCase

@end

@implementation VariantsRegistryTest

- (void)setUp {
  [Registry _setSharedRegistry:nil];
  [super setUp];
}

- (void)loadConfigFile:(NSString *)filename {
  Registry *registry = [Registry sharedRegistry];
  NSError *error;
  NSString *filePath =
      [[NSBundle bundleForClass:[self class]] pathForResource:filename
                                                       ofType:nil];
  [registry loadConfigFromData:[NSData dataWithContentsOfFile:filePath]
                         error:&error];
  XCTAssertNil(error);
}

- (void)testRegistrySingleton {
  XCTAssertNotNil([Registry sharedRegistry]);
  XCTAssertEqualObjects([Registry sharedRegistry], [Registry sharedRegistry]);
}

- (void)testErrorConditions {
  NSDictionary *config = @{
    @"variants" : @[
      @{
        @"id" : @"Fail",
        @"condition_operator" : @"AND",
        @"conditions" : @[
          @{@"type" : @"RANDOM", @"value" : @"foo", @"values" : @[ @"foo" ]}
        ],
        @"mods" : @[ @{@"flag" : @"foo", @"value" : @"bar"} ]
      }
    ]
  };
  XCTAssertThrows([[Registry sharedRegistry] loadConfigFromDictionary:config]);
}

- (void)testRandom {
  [self loadConfigFile:@"testdata.json"];
  Registry *registry = [Registry sharedRegistry];
  NSNumber *val = [registry flagValueWithName:@"always_passes"];
  XCTAssertTrue(val.boolValue);
  val = [registry flagValueWithName:@"always_fails"];
  XCTAssertFalse(val.boolValue);
}

- (void)testModRange {
  [self loadConfigFile:@"testdata.json"];
  Registry *registry = [Registry sharedRegistry];
  NSNumber *val =
      [registry flagValueWithName:@"mod_range" context:@{
        @"user_id" : @0
      }];
  XCTAssertTrue(val.boolValue);
  val = [registry flagValueWithName:@"mod_range" context:@{ @"user_id" : @3 }];
  XCTAssertTrue(val.boolValue);
  val = [registry flagValueWithName:@"mod_range" context:@{ @"user_id" : @9 }];
  XCTAssertTrue(val.boolValue);
  val = [registry flagValueWithName:@"mod_range" context:@{ @"user_id" : @50 }];
  XCTAssertFalse(val.boolValue);
}

- (void)testOperators {
  [self loadConfigFile:@"testdata.json"];
  Registry *registry = [Registry sharedRegistry];
  NSNumber *val = [registry flagValueWithName:@"or_result"
                                      context:[NSNumber numberWithBool:YES]];
  XCTAssertTrue(val.boolValue);
  val = [registry flagValueWithName:@"and_result"
                            context:[NSNumber numberWithBool:NO]];
  XCTAssertFalse(val.boolValue);
}

- (void)testNoOperators {
  XCTAssertThrowsSpecificNamed(
      [self loadConfigFile:@"broken_nooperator.json"], NSException,
      @"Invalid arguments to Variant initializer",
      @"Cannot have multiple variant conditions without an operator");
}

- (void)testNoCondition {
  XCTAssertThrowsSpecificNamed(
      [self loadConfigFile:@"broken_nocondition.json"], NSException,
      @"Invalid arguments to Variant initializer",
      @"Cannot have a Variant operator without multiple conditions");
}

- (void)testCustomCondition {
  Registry *registry = [Registry sharedRegistry];
  [registry
      registerConditionTypeWithId:@"CUSTOM"
                        specBlock:^ConditionEvaluator(id<NSCopying> value) {
                            return ^BOOL(id<NSCopying> context) {
                                return [((NSDictionary *)context)[@"password"]
                                    isEqualToString:(NSString *)value];
                            };
                        }];
  [self loadConfigFile:@"custom.json"];
  NSNumber *val = [registry flagValueWithName:@"custom_value" context:@{}];
  XCTAssertEqual(val.integerValue, 0);
  val = [registry flagValueWithName:@"custom_value"
                            context:@{
                              @"password" : @"wrong"
                            }];
  XCTAssertEqual(val.integerValue, 0);
  val = [registry flagValueWithName:@"custom_value"
                            context:@{
                              @"password" : @"secret"
                            }];
  XCTAssertEqual(val.integerValue, 42);
}

- (void)testGetFlags {
  [self loadConfigFile:@"testdata.json"];
  NSArray *allFlags = [[Registry sharedRegistry] allFlags];
  XCTAssertTrue([allFlags containsObject:@"always_passes"]);
  XCTAssertTrue([allFlags containsObject:@"always_fails"]);
  XCTAssertTrue([allFlags containsObject:@"coin_flip"]);
  XCTAssertTrue([allFlags containsObject:@"mod_range"]);
}

- (void)testGetVariants {
  [self loadConfigFile:@"testdata.json"];
  Variant *variant;
  for (Variant *v in [[Registry sharedRegistry] allVariants]) {
    if ([v.identifier isEqualToString:@"CoinFlipTest"]) {
      variant = v;
      break;
    }
  }
  XCTAssertNotNil(variant);
}

@end
