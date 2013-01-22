# Variants

This README details the Node.js implementation of Variants. For general background, see [the general README](https://github.com/Obvious/variants/)

## Detailed Design

The frontend server will load all defined variants to modify variant flags for individual requests.
Format

The variants are provided in a JSON file that is loaded at startup by the server and watched for changes in development.

Example
```
{
  "variants": [
    {
        "name": "ProductAccess"
      , "conditions": [
        {
          "type": "USER_ID"
          , "values": [
                "somedude74"
              , "anotherdude323"
              , "hax0r1337"
          ]
        }
      ]
      , "mods": [
        {
          "enable_access": true
        }
      ]
    }
    , {
        "name": "ShinyNewFeature"
      , "conditions": [
        {
            "type": "USER_ID_MOD"
          , “values”: [ 0, 9 ]
          , “cookie_type”: “NSID”
        }
      ]
      , "mods": [
        {
          "enable_shiny_new_feature": true
        }
      ]
    }
  ]
}
```

In the above example, there are two variants: “ProductAccess” and ShinyNewFeature. For some set of users, we declare that the global variable “enable_access” is set to true. Similarily, for ShinyNewFeature, a different condition is used to modify a different value, and so on.

# Using Variants

## Building and Installing

```shell
npm install variants
```

Or grab the source and

```shell
npm install
```

## Testing

```shell
npm install nodeunit -g
nodeunit tests/variants_test.js
```

# API Overview

Below is a list of the "exposed" interfaces.

Assuming the following:

```js
var variants = require('variants')
```

### variants.getFlagValue({string} flagName, {Object=} opt_context, {Object.<boolean>=} opt_forced) => {*}
Evaluates the flag value based on the given context object.
* flagName: Name of the variant flag to get the value for
* opt_context: Optional context object that contains fields relevant to evaluating conditions
* opt_forced: Optional map of variant ids that are forced to either true or false.
* Returns: Value specified in the variants JSON file or undefined if no conditions were met

### variants.loadFile({string} filepath, {function(Error, Object)} callback)
Asynchronously oads a JSON file that can declare variants and variant flags. Uses node `fs` API. Accepts a callback path that returns either an error object or a callback signaling completion.
* filepath: JSON file to load
* callback: Optional callback to handle errors

### variants.loadJson({Object} obj, {function(Error, Object)} callback)
Asynchronously oads a given raw JSON object that contains variants and variant flags. Accepts a callback path that returns either an error object or a callback signaling completion.
* obj: JSON object to parse
* callback: Optional callback to handle errors

### variants.registerConditionType({string} id, {function(*, Array.<*>)})
Registers a new condition type and handler associated with it.
* id: Case-insensitive identifier for the condition
* fn: Conditional function generator which takes the the parsed value and list of values respectively and must return a function that optionally takes a context Object and returns true or false.

Any context passed into the method that evaluates a flag will be passed into the condition handler, allowing you to define custom conditions based on context within your application.

E.g.
```js
registerConditionType('RANDOM', function (value) {
  if (value < 0 || value > 1) {
    throw new Error('Fractional value from 0-1 required')
  }

  return function() {
    if (!value) {
      return false
    }
    return Math.random() <= value
  }
})
```

### variants.registerFlag({string} flag)
Programmatic way to register a global flag value. This must come before parsing any files that use the flag.
* flag: the unique flag value

### variants.getAllVariants => {!Array.<Variant>}
Returns a list of all registered variants.

### variants.getAllFlags => {Array.<string>}
Returns a list of all registered flags.

## Variant

### Variant.getFlagValue({string} flagName) => {*}
Returns the value for the specific flag name.

# Appendix

## Contributing

Questions, comments, bug reports, and pull requests are all welcome.
Submit them at [the project on GitHub](https://github.com/Obvious/variants/nodejs/).

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
