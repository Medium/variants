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
	ResetAndLoadFile("testdata.json", t)
	testCases := map[string]bool{
		"always_passes": true,
		"always_fails":  false,
	}
	for flagName, expected := range testCases {
		v := GetFlagValue(flagName, nil).(bool)
		if v != expected {
			t.Errorf("GetFlagValue: expected %q to return %t, got %t.", flagName, expected, v)
		}
	}
}

func TestConditionals(t *testing.T) {
	ResetAndLoadFile("testdata.json", t)
	testCases := map[string]bool{
		"or_result":  true,
		"and_result": false,
	}
	for flagName, expected := range testCases {
		v := GetFlagValue(flagName, nil).(bool)
		if v != expected {
			t.Errorf("GetFlagValue: expected %q to return %t, got %t.", flagName, expected, v)
		}
	}
}

func TestModRange(t *testing.T) {
	ResetAndLoadFile("testdata.json", t)
	testCases := map[int]bool{
		0:  true,
		3:  true,
		9:  true,
		50: false,
	}
	for userId, expected := range testCases {
		v := GetFlagValue("mod_range", map[string]int{"user_id": userId}).(bool)
		if v != expected {
			t.Errorf("GetFlagValue: expected mod_range to return %t, got %t.", expected, v)
		}
	}
}
