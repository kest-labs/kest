package app

import "testing"

func TestHandlersModulesSkipsNilHandlers(t *testing.T) {
	handlers := &Handlers{}

	modules := handlers.Modules()
	if len(modules) != 0 {
		t.Fatalf("expected no modules, got %d", len(modules))
	}
}
