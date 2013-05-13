package variants

type Flag struct {
	Name        string      `json:"flag"`
	Description string      `json:"desc,omit_empty"`
	BaseValue   interface{} `json:"base_value"`
}
