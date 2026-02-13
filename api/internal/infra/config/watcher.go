package config

import (
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/kest-labs/kest/api/pkg/logger"
	"github.com/fsnotify/fsnotify"
)

// Observer is a callback function that's called when config changes
type Observer func(key string, oldValue, newValue any)

// Watcher manages configuration file watching and observer notifications
type Watcher struct {
	mu         sync.RWMutex
	repo       *Repository
	observers  map[string][]Observer
	globalObs  []Observer
	watcher    *fsnotify.Watcher
	watchFiles []string
	stopChan   chan struct{}
	isWatching bool
}

// NewWatcher creates a new configuration watcher
func NewWatcher(repo *Repository) *Watcher {
	return &Watcher{
		repo:       repo,
		observers:  make(map[string][]Observer),
		globalObs:  make([]Observer, 0),
		watchFiles: make([]string, 0),
		stopChan:   make(chan struct{}),
	}
}

// Watch registers an observer for a specific config key
// The observer will be called when the value for that key changes
func (w *Watcher) Watch(key string, observer Observer) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.observers[key] = append(w.observers[key], observer)
}

// WatchAll registers an observer for all config changes
func (w *Watcher) WatchAll(observer Observer) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.globalObs = append(w.globalObs, observer)
}

// Unwatch removes all observers for a specific key
func (w *Watcher) Unwatch(key string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	delete(w.observers, key)
}

// WatchFiles starts watching the specified files for changes
func (w *Watcher) WatchFiles(files ...string) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.isWatching {
		return nil // Already watching
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}

	w.watcher = watcher
	w.watchFiles = files

	for _, file := range files {
		// Watch the directory containing the file (for create events after editors save)
		dir := filepath.Dir(file)
		if err := watcher.Add(dir); err != nil {
			logger.Warningf("failed to watch directory %s: %v", dir, err)
		}
	}

	w.isWatching = true
	go w.watchLoop()

	return nil
}

// watchLoop runs in a goroutine to watch for file changes
func (w *Watcher) watchLoop() {
	debounce := make(map[string]time.Time)
	debounceDuration := 500 * time.Millisecond

	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}

			// Check if this is a file we're watching
			if !w.isWatchedFile(event.Name) {
				continue
			}

			// Only handle write and create events
			if event.Op&(fsnotify.Write|fsnotify.Create) == 0 {
				continue
			}

			// Debounce multiple rapid events
			now := time.Now()
			if lastTime, ok := debounce[event.Name]; ok {
				if now.Sub(lastTime) < debounceDuration {
					continue
				}
			}
			debounce[event.Name] = now

			// Reload configuration
			logger.Infof("config file changed: %s, reloading...", event.Name)
			w.reload()

		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			logger.Warningf("config watcher error: %v", err)

		case <-w.stopChan:
			return
		}
	}
}

// isWatchedFile checks if the file is in our watch list
func (w *Watcher) isWatchedFile(filename string) bool {
	absName, err := filepath.Abs(filename)
	if err != nil {
		return false
	}

	for _, file := range w.watchFiles {
		absWatched, err := filepath.Abs(file)
		if err != nil {
			continue
		}
		if absName == absWatched {
			return true
		}
	}
	return false
}

// reload reloads configuration and notifies observers
func (w *Watcher) reload() {
	w.mu.RLock()
	defer w.mu.RUnlock()

	// Store old values
	oldValues := make(map[string]any)
	for key := range w.observers {
		oldValues[key] = w.repo.Get(key)
	}

	// Reload configuration
	w.repo.loadFromEnv()

	// Check for changes and notify observers
	for key, observers := range w.observers {
		oldVal := oldValues[key]
		newVal := w.repo.Get(key)

		// Check if value changed (simple comparison)
		if !w.isEqual(oldVal, newVal) {
			for _, obs := range observers {
				go obs(key, oldVal, newVal)
			}
		}
	}

	// Notify global observers
	for _, obs := range w.globalObs {
		go obs("*", nil, nil)
	}
}

// isEqual performs a simple equality check
func (w *Watcher) isEqual(a, b any) bool {
	// Handle nil cases
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// Simple comparison for basic types
	switch av := a.(type) {
	case string:
		if bv, ok := b.(string); ok {
			return av == bv
		}
	case int:
		if bv, ok := b.(int); ok {
			return av == bv
		}
	case bool:
		if bv, ok := b.(bool); ok {
			return av == bv
		}
	case float64:
		if bv, ok := b.(float64); ok {
			return av == bv
		}
	}

	// For complex types, always consider changed
	return false
}

// Stop stops watching for file changes
func (w *Watcher) Stop() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if !w.isWatching {
		return nil
	}

	close(w.stopChan)
	w.isWatching = false

	if w.watcher != nil {
		return w.watcher.Close()
	}
	return nil
}

// --- Global Watcher Instance ---

var (
	globalWatcher     *Watcher
	globalWatcherOnce sync.Once
)

// GlobalWatcher returns the global configuration watcher
func GlobalWatcher() *Watcher {
	globalWatcherOnce.Do(func() {
		globalWatcher = NewWatcher(Instance())
	})
	return globalWatcher
}

// WatchEnvFile starts watching the .env file for changes
func WatchEnvFile() error {
	watcher := GlobalWatcher()

	// Find .env file
	envFile := ".env"
	if _, err := os.Stat(envFile); os.IsNotExist(err) {
		// Try common locations
		candidates := []string{".env", "../.env", "../../.env"}
		for _, candidate := range candidates {
			if _, err := os.Stat(candidate); err == nil {
				envFile = candidate
				break
			}
		}
	}

	return watcher.WatchFiles(envFile)
}

// OnConfigChange registers a callback for config changes
func OnConfigChange(key string, callback Observer) {
	GlobalWatcher().Watch(key, callback)
}

// OnAnyChange registers a callback for any config change
func OnAnyChange(callback Observer) {
	GlobalWatcher().WatchAll(callback)
}
