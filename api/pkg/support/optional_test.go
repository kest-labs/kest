package support

import "testing"

func TestOptional(t *testing.T) {
	value := "hello"
	opt := Of(&value)
	if !opt.IsPresent() {
		t.Error("optional should be present")
	}
	if opt.Get("") != "hello" {
		t.Errorf("expected value 'hello', got %s", opt.Get(""))
	}

	none := Of[string](nil)
	if none.IsPresent() {
		t.Error("nil optional should not be present")
	}
}

func TestOptionalValueOr(t *testing.T) {
	value := "hello"
	opt := Of(&value)
	if opt.Get("default") != "hello" {
		t.Error("Get should return the wrapped value when present")
	}

	none := Of[string](nil)
	if none.Get("default") != "default" {
		t.Error("Get should return the default when empty")
	}
}

func TestOptionalValueOrFunc(t *testing.T) {
	called := false
	value := "hello"
	opt := Of(&value)
	result := opt.OrElse(func() string {
		called = true
		return "default"
	})
	if result != "hello" || called {
		t.Error("OrElse should not call fallback when present")
	}

	none := Of[string](nil)
	result = none.OrElse(func() string {
		return "default"
	})
	if result != "default" {
		t.Error("OrElse should call fallback when empty")
	}
}

func TestOptionalIfPresent(t *testing.T) {
	called := false
	value := "hello"
	opt := Of(&value)
	opt.IfPresent(func(s string) {
		called = true
	})
	if !called {
		t.Error("IfPresent should call func when present")
	}

	called = false
	none := Of[string](nil)
	none.IfPresent(func(s string) {
		called = true
	})
	if called {
		t.Error("IfPresent should not call func for nil optionals")
	}
}
