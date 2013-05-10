package variants

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/rand"
	"strings"
)

type Registry struct {
	Name string

	// Map of currently registered variants.
	Variants map[string]Variant

	// Registered condition specs based on type. Specs create condition functions.
	ConditionSpecs map[string]func(...interface{}) func(interface{}) bool

	// Registered variant flags.
	Flags map[string]Flag

	// Maps flag names to a set of variant ids. Used to evaluate flag values.
	FlagToVariantIdMap map[string]map[string]bool
}

// NewRegistry allocates and returns a new Registry.
func NewRegistry(name string) *Registry {
	r := &Registry{
		Name:               name,
		Variants:           make(map[string]Variant),
		ConditionSpecs:     make(map[string]func(...interface{}) func(interface{}) bool),
		Flags:              make(map[string]Flag),
		FlagToVariantIdMap: make(map[string]map[string]bool),
	}
	r.RegisterBuiltInConditionTypes()
	return r
}

// DefaultRegistry is the default Regsitry used by Variants.
var DefaultRegistry = NewRegistry("MAIN")

func Reset() {
	DefaultRegistry = NewRegistry("MAIN")
}

func AddFlag(f Flag) error { return DefaultRegistry.AddFlag(f) }

func GetFlagValue(name string, context interface{}) interface{} {
	return DefaultRegistry.GetFlagValue(name, context)
}

func AddVariant(v Variant) error { return DefaultRegistry.AddVariant(v) }

func RegisterConditionType(id string, fn func(...interface{}) func(interface{}) bool) error {
	return DefaultRegistry.RegisterConditionType(id, fn)
}

func LoadConfig(filename string) error { return DefaultRegistry.LoadConfig(filename) }

// AddFlag registers a new flag, returning an error if a flag already
// exists with the same name.
func (r *Registry) AddFlag(f Flag) error {
	if _, present := r.Flags[f.Name]; present {
		return fmt.Errorf("Variant flag with the name %q is already registered.", f.Name)
	}
	r.Flags[f.Name] = f
	r.FlagToVariantIdMap[f.Name] = make(map[string]bool)
	return nil
}

// GetFlagValue returns the value of a flag based on a given context object.
func (r *Registry) GetFlagValue(name string, context interface{}) interface{} {
	val := r.Flags[name].BaseValue
	for variantId, _ := range r.FlagToVariantIdMap[name] {
		variant := r.Variants[variantId]
		if variant.Evaluate(context) {
			val = variant.GetFlagValue(name)
		}
	}
	return val
}

// AddVariant registers a new variant, returning an error if the flag
// already exists with the same Id or the flag name within any of the variant's
// mods is not registered.
func (r *Registry) AddVariant(v Variant) error {
	if _, found := r.Variants[v.Id]; found {
		return fmt.Errorf("Variant already registered with the Id %q", v.Id)
	}

	for _, m := range v.Mods {
		if _, found := r.Flags[m.FlagName]; !found {
			return fmt.Errorf("Flag with the name %q has not been registered.", m.FlagName)
		}
		r.FlagToVariantIdMap[m.FlagName][v.Id] = true
	}
	r.Variants[v.Id] = v
	return nil
}

func (r *Registry) RegisterConditionType(id string, fn func(...interface{}) func(interface{}) bool) error {
	id = strings.ToUpper(id)
	if _, found := r.ConditionSpecs[id]; found {
		return fmt.Errorf("Condition with id %q already registered.", id)
	}
	r.ConditionSpecs[id] = fn
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

// LoadFile reads a JSON-encoded file containing flags and variants
// and registers them with the receiver.
func (r *Registry) LoadConfig(filename string) error {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return err
	}
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
		if len(v.ConditionalOperator) == 0 {
			v.ConditionalOperator = ConditionalOperatorAnd
		}
		for i, c := range v.Conditions {
			if len(c.Values) == 0 {
				c.Values = []interface{}{c.Value}
			}
			if fn, ok := r.ConditionSpecs[c.Type]; ok {
				v.Conditions[i].Evaluator = fn(c.Values...)
			}
		}
		if err := r.AddVariant(v); err != nil {
			return err
		}
	}
	return nil
}
