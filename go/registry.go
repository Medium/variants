package variants

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/rand"
	"strings"
)

type Registry struct {
	// Currently registered variants mapped by id.
	variants map[string]Variant

	// Registered condition specs mapped on type. Specs create condition functions.
	conditionSpecs map[string]func(...interface{}) func(interface{}) bool

	// Registered variant flags mapped by name.
	flags map[string]Flag

	// Maps flag names to a set of variant ids. Used to evaluate flag values.
	flagToVariantIdMap map[string]map[string]bool
}

// NewRegistry allocates and returns a new Registry.
func NewRegistry() *Registry {
	r := &Registry{
		variants:           make(map[string]Variant),
		conditionSpecs:     make(map[string]func(...interface{}) func(interface{}) bool),
		flags:              make(map[string]Flag),
		flagToVariantIdMap: make(map[string]map[string]bool),
	}
	r.RegisterBuiltInConditionTypes()
	return r
}

// DefaultRegistry is the default Registry used by Variants.
var DefaultRegistry = NewRegistry()

func Reset() { DefaultRegistry = NewRegistry() }

func AddFlag(f Flag) error { return DefaultRegistry.AddFlag(f) }

func FlagValue(name string) interface{} { return DefaultRegistry.FlagValue(name) }

func FlagValueWithContext(name string, context interface{}) interface{} {
	return DefaultRegistry.FlagValueWithContext(name, context)
}

func Flags() []Flag { return DefaultRegistry.Flags() }

func AddVariant(v Variant) error { return DefaultRegistry.AddVariant(v) }

func Variants() []Variant { return DefaultRegistry.Variants() }

func RegisterConditionType(id string, fn func(...interface{}) func(interface{}) bool) error {
	return DefaultRegistry.RegisterConditionType(id, fn)
}

func LoadConfig(filename string) error { return DefaultRegistry.LoadConfig(filename) }

func LoadJSON(data []byte) error { return DefaultRegistry.LoadJSON(data) }

func ReloadConfig(filename string) error { return DefaultRegistry.ReloadConfig(filename) }

func ReloadJSON(data []byte) error { return DefaultRegistry.ReloadJSON(data) }

// AddFlag registers a new flag, returning an error if a flag already
// exists with the same name.
func (r *Registry) AddFlag(f Flag) error {
	if _, present := r.flags[f.Name]; present {
		return fmt.Errorf("Variant flag with the name %q is already registered.", f.Name)
	}
	r.flags[f.Name] = f
	r.flagToVariantIdMap[f.Name] = make(map[string]bool)
	return nil
}

// FlagValue returns the value of a flag based on a nil context.
func (r *Registry) FlagValue(name string) interface{} {
	return r.FlagValueWithContext(name, nil)
}

// FlagValueWithContext returns the value of a flag based on a given context object.
func (r *Registry) FlagValueWithContext(name string, context interface{}) interface{} {
	val := r.flags[name].BaseValue
	for variantId, _ := range r.flagToVariantIdMap[name] {
		variant := r.variants[variantId]
		if variant.Evaluate(context) {
			val = variant.FlagValue(name)
		}
	}
	return val
}

// Flags returns all flags registered with the receiver.
func (r *Registry) Flags() []Flag {
	result := []Flag{}
	for _, f := range r.flags {
		result = append(result, f)
	}
	return result
}

// AddVariant registers a new variant, returning an error if the flag
// already exists with the same Id or the flag name within any of the variant's
// mods is not registered.
func (r *Registry) AddVariant(v Variant) error {
	if _, found := r.variants[v.Id]; found {
		return fmt.Errorf("Variant already registered with the Id %q", v.Id)
	}

	for _, m := range v.Mods {
		if _, found := r.flags[m.FlagName]; !found {
			return fmt.Errorf("Flag with the name %q has not been registered.", m.FlagName)
		}
		r.flagToVariantIdMap[m.FlagName][v.Id] = true
	}
	r.variants[v.Id] = v
	return nil
}

// Variants returns a slice of all variants registered with the receiver.
func (r *Registry) Variants() []Variant {
	result := []Variant{}
	for _, v := range r.variants {
		result = append(result, v)
	}
	return result
}

func (r *Registry) RegisterConditionType(id string, fn func(...interface{}) func(interface{}) bool) error {
	id = strings.ToUpper(id)
	if _, found := r.conditionSpecs[id]; found {
		return fmt.Errorf("Condition with id %q already registered.", id)
	}
	r.conditionSpecs[id] = fn
	return nil
}

func (r *Registry) RegisterBuiltInConditionTypes() {
	// Register the RANDOM condition type.
	r.RegisterConditionType(ConditionTypeRandom, func(values ...interface{}) func(interface{}) bool {
		v, ok := values[0].(float64)
		if !ok || v < 0 || v > 1 {
			// TODO(andybons): Possibly return an error in this case.
			return nil
		}
		return func(_ interface{}) bool {
			return rand.Float64() <= v
		}
	})

	// Register the MOD_RANGE condition type.
	r.RegisterConditionType(ConditionTypeModRange, func(values ...interface{}) func(interface{}) bool {
		if len(values) != 3 {
			// TODO(andybons): Return error in this case?
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

type ConfigFile struct {
	Flags    []Flag    `json:"flag_defs"`
	Variants []Variant `json:"variants"`
}

// ReloadJSON constructs a union of the registry created by the given
// JSON byte array and the receiver, overriding any flag or variant
// definitions present inthe new config but leaving all others alone.
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
	registry := NewRegistry()
	if err := registry.LoadConfig(filename); err != nil {
		return err
	}
	return r.mergeRegistry(registry)
}

func (r *Registry) mergeRegistry(registry *Registry) error {
	for _, flag := range registry.Flags() {
		delete(r.flags, flag.Name)
		r.AddFlag(flag)
	}
	for _, variant := range registry.Variants() {
		delete(r.variants, variant.Id)
		r.AddVariant(variant)
	}
	return nil
}

// LoadJSON reads a byte array of JSON containing flags and variants
// and registers them with the receiver.
func (r *Registry) LoadJSON(data []byte) error {
	config := ConfigFile{}
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
			return fmt.Errorf("Variant with ID %q must have at least one mod.", v.Id)
		}
		if len(v.ConditionalOperator) == 0 {
			v.ConditionalOperator = ConditionalOperatorAnd
		}
		for i, c := range v.Conditions {
			if len(c.Values) == 0 {
				c.Values = []interface{}{c.Value}
			}
			if fn, ok := r.conditionSpecs[c.Type]; ok {
				v.Conditions[i].Evaluator = fn(c.Values...)
			}
		}
		if err := r.AddVariant(v); err != nil {
			return err
		}
	}
	return nil
}

// LoadFile reads a JSON-encoded file containing flags and variants
// and registers them with the receiver.
func (r *Registry) LoadConfig(filename string) error {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return err
	}
	return r.LoadJSON(data)
}
