# Variants

# Background
In web applications it is common to provide varying experiences to unique sets of users. A flexible design should allow implementations of common patterns in web development like:

* A/B testing
* Experimental features
* Trusted tester groups
* Gradual feature rollouts

# Overview

Variants provide an expressive way to define and conditionally modify experimental features, which can also be forcefully adjusted (for development).

Note that the following README only provides a general overview of variants, and is language independent. Currently, it is only supported in Node.js. See the specific README for more information.

To conditionally gate certain features, they must be protected by variant flags. Variant flags are globally unique strings that can point to a language primitive, array or object. Most commonly, variant flags are simple boolean values so that the below code is possible:

```js
if (variants.getFlagValue("enable_product_access")) {
  throw new Error(‘Authenticated failed.’)
}
```

# Design

* Each service contains variants
* Variants contain 0 or more conditions and 1 or more mods
* Conditions evaluate the current request based on the condition type and values
* Mods modify variant flags
* Variant flags are checked in code to gate control flow

## Variant

Variants are globally defined objects that may optionally modify values based on some conditions. All variants are evaluated on a per request basis, which means that they are scoped to request-based values such as: user ip, specific users, groups of users, query parameters, etc.

Variants must have a name and a list of conditions and mods. A variant must contain at least one mod to be valid.

```
variant: {
  required string name
  optional string conditional_operator [default = “AND”]
  optional condition[] conditions
  required mod[] mods
}
```

## Condition

Conditions return true or false based on the current request object. By default, all conditions must evaluate to “true” in order to trigger the mods in a variant, but may be changed based on the conditional_operator field.

Below is a list of condition types:

### USER_ID

User id is a condition that evaluates the given condition based on a list of usernames in the “values” field.

E.g.
```
{
  “type”: “USER_ID”
  , “values”: [
        “somedude74”
      , “anotherdude323”
      , “hax0r1337”
  ]
}
```

### USER_ID_MOD

User id mods use a hashed value of the current user’s username mapped onto a range from 0-99. It allows the properties “range_start” and “range_end”, which contain values between 0-99 and range_end must be greater than range_start.

By default, this uses the unique user id of an authenticated user. However, the “cookie_type” field can be set to “NSID” to refer to unauthenticated users.

E.g.
```
{
    “type”: “USER_ID_MOD”
  , “values”: [ 0, 9 ]
}
```

Note: This is useful for rolling out new features, such as to 1% -> 10% -> 50% -> 100% of users.

### RANDOM

Random will randomly determine whether or not a given request is eligible for the variant. 

E.g.
```
{
    “type”: “RANDOM”
  , “value”: 0.25
}
```

### Mod

Mods are triggered when the conditions are met on the given variant. The format of a mod is simply a key and a value. The key must refer to a global identifier for the variant flag.

Full spec

Spec in pseudo-protobuf format:

```
message Variants {
  repeated Variant variants;
}

message Variant {

  enum Operator {
    AND,
    OR
  }

  // Unique identifier
  required string name;

  // Readable description of the feature.
  optional string description;

  // Optional operator to evaluate the conditions.
  optional Operator conditional_operator [default = AND];

  // List of conditions to evaluate.
  repeated Condition conditions;

  // List of mods to be triggered.
  repeated Mod mods;
}

message Condition {

  enum Type {
    RANDOM,
    USER_ID,
    USER_ID_MOD,
    USER_IP
  };

  // Type of condition.
  required Type type;

  // Single value.
  optional * value;

  // List of values.
  repeated * values;
}

message Mod {
  // Name of the variant flag to modify.
  required string flag;

  // Value to set.
  required * value;
}
```

# Appendix

## Contributing

Questions, comments, bug reports, and pull requests are all welcome.
Submit them at [the project on GitHub](https://github.com/Obvious/variants/).

Bug reports that include steps-to-reproduce (including code) are the
best. Even better, make them in the form of pull requests that update
the test suite. Thanks!


## Author

[David Byttow](https://github.com/guitardave24)
supported by [The Obvious Corporation](http://obvious.com/).


## License

Copyright 2012 [The Obvious Corporation](http://obvious.com/).

Licensed under the Apache License, Version 2.0.
See the top-level file `LICENSE.txt` and
(http://www.apache.org/licenses/LICENSE-2.0).
