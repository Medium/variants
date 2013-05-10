package variants

const (
	ConditionTypeRandom    = "RANDOM"
	ConditionTypeModRange  = "MOD_RANGE"
	ConditionTypeUserId    = "USER_ID"
	ConditionTypeUserIdMod = "USER_ID_MOD"
	ConditionTypeUserIp    = "USER_IP"
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
