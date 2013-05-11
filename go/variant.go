package variants

const (
	ConditionalOperatorAnd = "AND"
	ConditionalOperatorOr  = "OR"
)

// Variants must have an id, a list of conditions, and mods.
// A variant must contain at least one mod to be valid.
type Variant struct {
	Id                  string
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

// Evaluate returns the result of evaluating each condition of the
// receiver given a context.
func (v *Variant) Evaluate(context interface{}) bool {
	if len(v.Conditions) == 1 || v.ConditionalOperator == ConditionalOperatorAnd {
		for _, c := range v.Conditions {
			if !c.Evaluate(context) {
				return false
			}
		}
		return true
	} else if v.ConditionalOperator == ConditionalOperatorOr {
		for _, c := range v.Conditions {
			if c.Evaluate(context) {
				return true
			}
		}
		return false
	}

	return false
}
