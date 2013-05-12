package variants

import (
	"testing"
)

func ResetAndLoadFile(filename string, t *testing.T) {
	Reset()
	if err := LoadConfig(filename); err != nil {
		t.Fatalf("LoadConfig: Expected no error, but got %q", err.Error())
	}
}

func TestDuplicateFlags(t *testing.T) {
	Reset()
	if err := AddFlag(Flag{Name: "GOOB"}); err != nil {
		t.Errorf("AddFlag: Expected no error but got %q", err.Error())
	}
	if err := AddFlag(Flag{Name: "GOOB"}); err == nil {
		t.Error("AddFlag: Expected duplicate flag error, but got nil.")
	}
}

func TestDuplicateVariant(t *testing.T) {
	Reset()
	if err := AddVariant(Variant{Id: "GOOB"}); err != nil {
		t.Errorf("AddVariant: Expected no error but got %q", err.Error())
	}
	if err := AddVariant(Variant{Id: "GOOB"}); err == nil {
		t.Error("AddVariant: Expected duplicate variant error, but got nil.")
	}
}

func TestRandom(t *testing.T) {
	ResetAndLoadFile("testdata/testdata.json", t)
	testCases := map[string]bool{
		"always_passes": true,
		"always_fails":  false,
	}
	for flagName, expected := range testCases {
		v := FlagValue(flagName)
		if v != expected {
			t.Errorf("FlagValue: expected %q to return %t, got %t.", flagName, expected, v)
		}
	}
}

func TestConditionals(t *testing.T) {
	ResetAndLoadFile("testdata/testdata.json", t)
	testCases := map[string]bool{
		"or_result":  true,
		"and_result": false,
	}
	for flagName, expected := range testCases {
		v := FlagValue(flagName)
		if v != expected {
			t.Errorf("FlagValue: expected %q to return %t, got %t.", flagName, expected, v)
		}
	}
}

func TestModRange(t *testing.T) {
	ResetAndLoadFile("testdata/testdata.json", t)
	testCases := map[int]bool{
		0:  true,
		3:  true,
		9:  true,
		50: false,
	}
	for userId, expected := range testCases {
		v := FlagValueWithContext("mod_range", map[string]int{"user_id": userId})
		if v != expected {
			t.Errorf("FlagValueWithContext: expected mod_range to return %t, got %t.", expected, v)
		}
	}
}

func TestLoadJSON(t *testing.T) {
	Reset()
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
	json := `{
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
	}`
	if err := LoadJSON([]byte(json)); err != nil {
		t.Errorf("LoadJSON: expected no error, but got %q.", err.Error())
	}
	testCases := map[string]bool{
		"andybons":  true,
		"sjkaliski": false,
	}
	for uname, expected := range testCases {
		ctx := map[string]string{"username": uname}
		actual := FlagValueWithContext("enable_new_hotness_feature", ctx)
		if expected != actual {
			t.Errorf("FlagValueWithContext: Expected enable_new_hotness_feature to be %t, got %t.", expected, actual)
		}
	}
}

func TestCustomCondition(t *testing.T) {
	Reset()
	RegisterConditionType("CUSTOM", func(values ...interface{}) func(interface{}) bool {
		value := values[0].(string)

		return func(context interface{}) bool {
			c := context.(map[string]string)
			return c["password"] == value
		}
	})
	if err := LoadConfig("testdata/custom.json"); err != nil {
		t.Fatalf("LoadConfig: Expected no error, but got %q", err.Error())
	}

	type testCase struct {
		Context  map[string]string
		Expected float64
	}
	testCases := []testCase{
		testCase{
			Context:  map[string]string{"password": "wrong"},
			Expected: 0,
		},
		testCase{
			Context:  map[string]string{"password": "secret"},
			Expected: 42,
		},
		testCase{
			Context:  map[string]string{},
			Expected: 0,
		},
	}
	for _, tc := range testCases {
		v := FlagValueWithContext("custom_value", tc.Context)
		if v != tc.Expected {
			t.Errorf("FlagValueWithContext: expected custom_value to return %f, got %f.", tc.Expected, v)
		}
	}
}

func TestGetFlags(t *testing.T) {
	ResetAndLoadFile("testdata/testdata.json", t)

	testCases := []string{
		"always_passes",
		"always_fails",
		"coin_flip",
		"mod_range",
	}
	names := []string{}
	for _, f := range Flags() {
		names = append(names, f.Name)
	}
	for _, n := range testCases {
		if !contains(names, n) {
			t.Errorf("Flags: expected %q to be present.", n)
		}
	}
}

func TestGetVariants(t *testing.T) {
	ResetAndLoadFile("testdata/testdata.json", t)
	testCases := []string{
		"AlwaysFailsTest",
		"AlwaysPassesTest",
		"CoinFlipTest",
		"ModRangeTest",
		"OrTest",
		"AndTest",
	}
	ids := []string{}
	for _, v := range Variants() {
		ids = append(ids, v.Id)
	}
	for _, id := range testCases {
		if !contains(ids, id) {
			t.Errorf("Variants: Expected Variant with ID %q to be present.", id)
		}
	}
}

func contains(arr []string, s string) bool {
	for _, v := range arr {
		if v == s {
			return true
		}
	}
	return false
}

func TestReloadConfig(t *testing.T) {
	ResetAndLoadFile("testdata/testdata.json", t)
	testCases := map[string]bool{
		"always_passes": true,
		"always_fails":  false,
	}
	for flagName, expected := range testCases {
		v := FlagValue(flagName)
		if v != expected {
			t.Errorf("FlagValue: expected %q to return %t, got %t.", flagName, expected, v)
		}
	}

	if err := ReloadConfig("testdata/testdata_reloaded.json"); err != nil {
		t.Errorf("ReloadConfig: expected no error but got %q.", err.Error())
	}
	testCases = map[string]bool{
		"always_passes": true,
		"always_fails":  true,
		"coin_flip":     true,
		"mod_range":     true,
	}
	for flagName, expected := range testCases {
		v := FlagValue(flagName)
		if v != expected {
			t.Errorf("FlagValue: expected %q to return %t, got %t.", flagName, expected, v)
		}
	}
}

func TestNoMods(t *testing.T) {
	Reset()
	if err := LoadConfig("testdata/broken_nomods.json"); err == nil {
		t.Error("LoadConfig: Expected error for not having at least one mod in the variant.")
	}
}

func TestNoOperator(t *testing.T) {
	Reset()
	if err := LoadConfig("testdata/broken_nooperator.json"); err == nil {
		t.Error("LoadConfig: Expected error for not specifying an operator with more than one condition.")
	}
}
