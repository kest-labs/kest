package http

import (
	"strings"
	"testing"
)

func TestReadLimited(t *testing.T) {
	data, truncated, err := ReadLimited(strings.NewReader("hello world"), 5)
	if err != nil || !truncated || string(data) != "hello" {
		t.Fatalf("got %q truncated=%v err=%v", data, truncated, err)
	}

	data, truncated, err = ReadLimited(strings.NewReader("hello"), 5)
	if err != nil || truncated || string(data) != "hello" {
		t.Fatalf("exact-size body must not be truncated: %q %v %v", data, truncated, err)
	}

	data, truncated, err = ReadLimited(strings.NewReader("hello"), 0)
	if err != nil || truncated || string(data) != "hello" {
		t.Fatalf("max<=0 must disable the limit: %q %v %v", data, truncated, err)
	}
}

func TestReadAllLimited(t *testing.T) {
	if _, err := ReadAllLimited(strings.NewReader("too long"), 3); err == nil {
		t.Fatal("expected error for oversized body")
	}
	if data, err := ReadAllLimited(strings.NewReader("ok"), 3); err != nil || string(data) != "ok" {
		t.Fatalf("got %q %v", data, err)
	}
}
