package main

import (
	"path/filepath"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/kest-labs/kest/cli/internal/dotenv"
	"github.com/kest-labs/kest/cli/internal/variable"
)

// workspaceEnvFile is where `{{$env.NAME}}` looks when the OS environment does
// not define NAME. Only <workspace>/.kest/.env is read; an application-level ./.env
// is intentionally NOT loaded because it usually belongs to the application
// under test and may hold unrelated (or production) settings.
const workspaceEnvFile = ".env"

func init() {
	variable.EnvFallback = workspaceEnvLookup
}

func workspaceEnvLookup(name string) (string, bool) {
	root, err := config.FindWorkspaceRoot()
	if err != nil || root == "" {
		return "", false
	}
	vals := dotenv.ReadFile(filepath.Join(root, ".kest", workspaceEnvFile))
	v, ok := vals[name]
	return v, ok
}
