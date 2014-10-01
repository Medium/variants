# Variants

This README details the Go implementation of Variants. For general background, see [the general README](https://github.com/Obvious/variants/).

## Detailed Design

Flag and Variant definitions can be defined in a JSON file that can be loaded by a Registry object that manages the sanity and evaluation of each condition.

Example
```json
{
  "flag_defs": [{
    "flag": "ab_test",
    "base_value": false
  }],

  "variants": [{
    "id": "FeatureABTest",
    "conditions": [{
      "type": "RANDOM",
      "value": 0.5
    }],

    "mods": [{
      "flag": "ab_test",
      "value": true
    }]
  }]
}
```

In the above example, a flag called "ab_test" is defined, and behavior surrounding how that flag will be evaluated is defined by the variant definition below it. If the condition defined by the variant is met, then the associated mods will be realized (the flag "ab_test" will evaluate to true). The variant is using the built-in RANDOM condition type that will evaluate its result by comparing a random number between 0.0 and 1.0 to the given value (0.5 in this case). So, in practice, a call to `FlagValue("ab_test")` will return true 50% of the time.

But say you don't want to use the built-in condition types...

Another example
```json
{
  "flag_defs": [{
    "flag": "enable_new_hotness_feature",
    "base_value": false
  }],

  "variants": [{
    "id": "EnableNewHotnessFeature",
    "conditions": [{
      "type": "CUSTOM",
      "values": [
        "andybons",
        "pupius",
        "guitardave24"
      ]
    }],

    "mods": [{
      "flag": "enable_new_hotness_feature",
      "value": true
    }]
  }]
}
```

Now, there is no built-in condition type called CUSTOM, so when the above config is loaded, bad things will happen. We need to define how a CUSTOM condition should be evaluated before the above config is loaded.

```go
RegisterConditionType("CUSTOM", func(values ...interface{}) func(interface{}) bool {
  usernames := []string{}
  for _, v := range values {
    usernames = append(usernames, v.(string))
  }

  return func(context interface{}) bool {
    c := context.(map[string]string)
    for _, u := range usernames {
      if c["username"] == u {
        return true
      }
    }
    return false
  }
})
```

The above code evaluates the CUSTOM condition by checking to see if the value of the "username" key in the passed in context object is present in the values passed when the variant is constructed. Here are a couple examples of getting the flag value:

```go
ctx := map[string]string{"username": "andybons"}
hasAccess := FlagValueWithContext("enable_new_hotness_feature", ctx) // true

ctx = map[string]string{"username": "tessr"}
hasAccess := FlagValueWithContext("enable_new_hotness_feature", ctx) // false
```

Take a look at the unit tests for a working example.

# Using Variants

## Installation

Install variants by using the "go get" command:

```shell
go get github.com/medium/variants/go
```

```go
import "github.com/medium/variants/go"
```

## Testing

```shell
go test
```

# Appendix

## Contributing

Questions, comments, bug reports, and pull requests are all welcome.
Submit them at [the project on GitHub](https://github.com/Obvious/variants/).

Bug reports that include steps-to-reproduce (including code) are the
best. Even better, make them in the form of pull requests that update
the test suite. Thanks!


## Author

[Andrew Bonventre](https://github.com/andybons)
supported by [Poptip](http://poptip.com) and [The Obvious Corporation](http://obvious.com/).


## License

Copyright 2012 [The Obvious Corporation](http://obvious.com/).

Licensed under the Apache License, Version 2.0.
See the top-level file `LICENSE.txt` and
(http://www.apache.org/licenses/LICENSE-2.0).
