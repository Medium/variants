package variants

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/rand"
	"strings"
	"sync"
)

// A Registry keeps track of all Flags, Conditions, and Variants.
type Registry struct {
	// This mutex protects the fields below.
	sync.RWMutex

	// Currently registered variants mapped by ID.
	variants map[string]Variant

	// Registered condition specs mapped on type. Specs create condition functions.
	conditionSpecs map[string]func(...interface{}) func(interface{}) bool

	// Registered variant flags mapped by name.
	flags map[string]Flag

	// Maps flag names to a set of variant IDs. Used to evaluate flag values.
	flagToVariantIDMap map[string]map[string]struct{}
}

// NewRegistry allocates and returns a new Registry.
func NewRegistry() *Registry {
	r := &Registry{
		variants:           map[string]Variant{},
		conditionSpecs:     map[string]func(...interface{}) func(interface{}) bool{},
		flags:              map[string]Flag{},
		flagToVariantIDMap: map[string]map[string]struct{}{},
	}
	r.registerBuiltInConditionTypes()
	return r
}

var (
	// DefaultRegistry is the default Registry used by Variants.
	DefaultRegistry   = NewRegistry()
	defaultRegistryMu sync.RWMutex
)

// Reset clears any registered objects within the DefaultRegistry.
func Reset() {
	defaultRegistryMu.Lock()
	DefaultRegistry = NewRegistry()
	defaultRegistryMu.Unlock()
}

// AddFlag adds f to the DefaultRegistry.
func AddFlag(f Flag) error {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.AddFlag(f)
}

// FlagValue returns the value of a flag with the given name from the DefaultRegistry.
func FlagValue(name string) interface{} {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.FlagValue(name)
}

// FlagValueWithContext returns the value of the flag with the given name and
// context from the DefaultRegistry.
func FlagValueWithContext(name string, context interface{}) interface{} {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.FlagValueWithContext(name, context)
}

// Flags returns all Flags registered with the DefaultRegistry.
func Flags() []Flag {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.Flags()
}

// AddVariant adds v to the DefaultRegistry.
func AddVariant(v Variant) error {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.AddVariant(v)
}

// Variants returns all variants registered within the DefaultRegistry.
func Variants() []Variant {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.Variants()
}

// RegisterConditionType registers a Condition type with the given ID
// and evaluating function with the DefaultRegistry.
func RegisterConditionType(id string, fn func(...interface{}) func(interface{}) bool) error {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.RegisterConditionType(id, fn)
}

// LoadConfig loads filename, a JSON-encoded set of Mods, Conditions, and Variants,
// with the DefaultRegistry.
func LoadConfig(filename string) error {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.LoadConfig(filename)
}

// LoadJSON loads data, a JSON-encoded set of Mods, Conditions, and Variants,
// with the DefaultRegistry.
func LoadJSON(data []byte) error {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.LoadJSON(data)
}

// ReloadConfig reloads the given filename config into the DefaultRegistry.
func ReloadConfig(filename string) error {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.ReloadConfig(filename)
}

// ReloadJSON reloads the given JSON-encoded byte slice into the DefaultRegistry.
func ReloadJSON(data []byte) error {
	defaultRegistryMu.RLock()
	defer defaultRegistryMu.RUnlock()
	return DefaultRegistry.ReloadJSON(data)
}

// AddFlag registers a new flag, returning an error if a flag already
// exists with the same name.
func (r *Registry) AddFlag(f Flag) error {
	r.Lock()
	defer r.Unlock()
	if _, present := r.flags[f.Name]; present {
		return fmt.Errorf("Variant flag with the name %q is already registered.", f.Name)
	}
	r.flags[f.Name] = f
	r.flagToVariantIDMap[f.Name] = map[string]struct{}{}
	return nil
}

// FlagValue returns the value of a flag based on a nil context.
func (r *Registry) FlagValue(name string) interface{} {
	return r.FlagValueWithContext(name, nil)
}

// FlagValueWithContext returns the value of a flag based on a given context object.
// The first variant that is satisfied and has a mod associated with the given flag name
// will be evaluated. The order of variant evaluation is nondeterministic.
// TODO(andybons): Deterministic behavior through rule ordering.
func (r *Registry) FlagValueWithContext(name string, context interface{}) interface{} {
	r.RLock()
	defer r.RUnlock()
	val := r.flags[name].BaseValue
	for variantID := range r.flagToVariantIDMap[name] {
		variant := r.variants[variantID]
		if variant.Evaluate(context) {
			val = variant.FlagValue(name)
		}
	}
	return val
}

// Flags returns all flags registered with the receiver.
func (r *Registry) Flags() []Flag {
	r.RLock()
	defer r.RUnlock()
	result := make([]Flag, len(r.flags))
	i := 0
	for _, f := range r.flags {
		result[i] = f
		i++
	}
	return result
}

// AddVariant registers a new variant, returning an error if the flag
// already exists with the same Id or the flag name within any of the variant's
// mods is not registered.
func (r *Registry) AddVariant(v Variant) error {
	r.Lock()
	defer r.Unlock()
	if _, found := r.variants[v.ID]; found {
		return fmt.Errorf("Variant already registered with the ID %q", v.ID)
	}

	for _, m := range v.Mods {
		if _, found := r.flags[m.FlagName]; !found {
			return fmt.Errorf("Flag with the name %q has not been registered.", m.FlagName)
		}
		r.flagToVariantIDMap[m.FlagName][v.ID] = struct{}{}
	}
	r.variants[v.ID] = v
	return nil
}

// Variants returns a slice of all variants registered with the receiver.
func (r *Registry) Variants() []Variant {
	r.RLock()
	defer r.RUnlock()
	result := make([]Variant, len(r.variants))
	i := 0
	for _, v := range r.variants {
		result[i] = v
		i++
	}
	return result
}

// RegisterConditionType registers the condition type with an ID unique to the
// set of registered condition types with a function that determines how the
// condition will be evaluated.
func (r *Registry) RegisterConditionType(id string, fn func(...interface{}) func(interface{}) bool) error {
	r.Lock()
	defer r.Unlock()
	id = strings.ToUpper(id)
	if _, found := r.conditionSpecs[id]; found {
		return fmt.Errorf("Condition with id %q already registered.", id)
	}
	// TODO(andybons): Input checking/sanitization is left to the user to muddle around with.
	// Determine a better way of handling bad input.
	r.conditionSpecs[id] = fn
	return nil
}

const (
	conditionTypeRandom   = "RANDOM"
	conditionTypeModRange = "MOD_RANGE"
)

func (r *Registry) registerBuiltInConditionTypes() {
	// Register the RANDOM condition type.
	r.RegisterConditionType(conditionTypeRandom, func(values ...interface{}) func(interface{}) bool {
		v, ok := values[0].(float64)
		if !ok || v < 0 || v > 1 {
			return nil
		}
		return func(_ interface{}) bool {
			return rand.Float64() <= v
		}
	})

	// Register the MOD_RANGE condition type.
	r.RegisterConditionType(conditionTypeModRange, func(values ...interface{}) func(interface{}) bool {
		if len(values) != 3 {
			return nil
		}

		// TODO(andybons): These will panic if the type assertion fails.
		key := values[0].(string)
		rangeBegin := int(values[1].(float64))
		rangeEnd := int(values[2].(float64))
		if rangeBegin > rangeEnd {
			return nil
		}

		return func(context interface{}) bool {
			ctx, ok := context.(map[string]int)
			if !ok {
				return false
			}
			mod := ctx[key] % 100
			return mod >= rangeBegin && mod <= rangeEnd
		}
	})
}

type configFile struct {
	Flags    []Flag    `json:"flag_defs"`
	Variants []Variant `json:"variants"`
}

// ReloadJSON constructs a union of the registry created by the given
// JSON byte array and the receiver, overriding any flag or variant
// definitions present in the new config but leaving all others alone.
func (r *Registry) ReloadJSON(data []byte) error {
	registry := NewRegistry()
	if err := registry.LoadJSON(data); err != nil {
		return err
	}
	return r.mergeRegistry(registry)
}

// ReloadConfig constructs a union of the registry created by the given
// config filename and the receiver, overriding any flag or variant
// definitions present in the new config but leaving all others alone.
func (r *Registry) ReloadConfig(filename string) error {
	other := NewRegistry()
	if err := other.LoadConfig(filename); err != nil {
		return err
	}
	return r.mergeRegistry(other)
}

func (r *Registry) mergeRegistry(registry *Registry) error {
	for _, flag := range registry.Flags() {
		delete(r.flags, flag.Name)
		r.AddFlag(flag)
	}
	for _, variant := range registry.Variants() {
		delete(r.variants, variant.ID)
		r.AddVariant(variant)
	}
	return nil
}

// LoadJSON reads a byte array of JSON containing flags and variants
// and registers them with the receiver.
func (r *Registry) LoadJSON(data []byte) error {
	config := configFile{}
	if err := json.Unmarshal(data, &config); err != nil {
		return err
	}
	for _, f := range config.Flags {
		if err := r.AddFlag(f); err != nil {
			return err
		}
	}
	for _, v := range config.Variants {
		if len(v.Mods) == 0 {
			return fmt.Errorf("Variant with ID %q must have at least one mod.", v.ID)
		}
		if len(v.Conditions) > 1 && len(v.ConditionalOperator) == 0 {
			return fmt.Errorf("Variant with ID %q has %d conditions but no conditional operator specified.", v.ID, len(v.Conditions))
		}
		for i, c := range v.Conditions {
			if len(c.Values) == 0 {
				c.Values = []interface{}{c.Value}
			}
			r.Lock()
			if fn, ok := r.conditionSpecs[c.Type]; ok {
				v.Conditions[i].Evaluator = fn(c.Values...)
			}
			r.Unlock()
		}
		if err := r.AddVariant(v); err != nil {
			return err
		}
	}
	return nil
}

// LoadConfig reads a JSON-encoded file containing flags and variants
// and registers them with the receiver.
func (r *Registry) LoadConfig(filename string) error {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return err
	}
	return r.LoadJSON(data)
}
