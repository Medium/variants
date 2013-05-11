package variants

const (
	ConditionTypeRandom   = "RANDOM"
	ConditionTypeModRange = "MOD_RANGE"
)

type Condition struct {
	Type      string
	Value     interface{}
	Values    []interface{}
	Evaluator func(context interface{}) bool
}

func (c *Condition) Evaluate(context interface{}) bool {
	return c.Evaluator(context)
}
