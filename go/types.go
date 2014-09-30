package variants

// A Flag defines a value that may change on a contextual basis
// based on the Variants that refer to it.
type Flag struct {
	Name        string      `json:"flag"`
	Description string      `json:"desc,omit_empty"`
	BaseValue   interface{} `json:"base_value"`
}

// A Mod defines how a flag changes. Variants contain Mods that
// take effect when the Variant is “active.”
type Mod struct {
	FlagName string `json:"flag"`
	Value    interface{}
}

// A Condition wraps a user-defined method used to evaluate
// whether the owning Variant is “active.”
type Condition struct {
	Type      string
	Value     interface{}
	Values    []interface{}
	Evaluator func(context interface{}) bool
}

// Evaluate returns whether the condition has been met with
// the given context.
func (c *Condition) Evaluate(context interface{}) bool {
	if c.Evaluator == nil {
		return false
	}
	return c.Evaluator(context)
}

// A Variant contains a list of conditions and a set of mods.
// When all conditions are met, the mods take effect.
// A variant must contain at least one mod to be valid.
type Variant struct {
	ID                  string
	Description         string `json:"desc"`
	Mods                []Mod
	ConditionalOperator string `json:"condition_operator"`
	Conditions          []Condition
}

// FlagValue returns the value of a modified flag for the receiver.
func (v *Variant) FlagValue(name string) interface{} {
	for _, m := range v.Mods {
		if m.FlagName == name {
			return m.Value
		}
	}
	return nil
}

const (
	conditionalOperatorAnd = "AND"
	conditionalOperatorOr  = "OR"
)

// Evaluate returns the result of evaluating each condition of the
// receiver given a context.
func (v *Variant) Evaluate(context interface{}) bool {
	if len(v.Conditions) == 1 || v.ConditionalOperator == conditionalOperatorAnd {
		for _, c := range v.Conditions {
			if !c.Evaluate(context) {
				return false
			}
		}
		return true
	} else if v.ConditionalOperator == conditionalOperatorOr {
		for _, c := range v.Conditions {
			if c.Evaluate(context) {
				return true
			}
		}
	}
	return false
}
