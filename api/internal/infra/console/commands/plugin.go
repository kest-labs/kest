package commands

import (
	"fmt"
	"strings"

	"github.com/kest-labs/kest/api/internal/infra/console"
	"github.com/kest-labs/kest/api/internal/infra/plugin"
)

// PluginListCommand lists all installed plugins
type PluginListCommand struct {
	output *console.Output
}

func NewPluginListCommand() *PluginListCommand {
	return &PluginListCommand{
		output: console.NewOutput(),
	}
}

func (c *PluginListCommand) Name() string {
	return "plugin:list"
}

func (c *PluginListCommand) Description() string {
	return "List all installed plugins"
}

func (c *PluginListCommand) Usage() string {
	return "zgo plugin:list"
}

func (c *PluginListCommand) Run(args []string) error {
	registry := plugin.Global()
	plugins := registry.List()

	if len(plugins) == 0 {
		c.output.Info("No plugins installed")
		c.output.Info("")
		c.output.Info("Install plugins with:")
		c.output.Info("  go install github.com/kest-labs/kest/api-ai/cmd/zgo-ai@latest")
		return nil
	}

	c.output.Success(fmt.Sprintf("Found %d plugin(s):", len(plugins)))
	c.output.Info("")

	// Print table header
	c.output.Info(fmt.Sprintf("%-15s %-15s %s", "NAME", "VERSION", "BINARY"))
	c.output.Info(strings.Repeat("-", 70))

	// Print plugins
	for _, p := range plugins {
		version := p.Version
		if version == "" {
			version = "unknown"
		}
		c.output.Info(fmt.Sprintf("%-15s %-15s %s", p.Name, version, p.Binary))
	}

	c.output.Info("")
	c.output.Info("Usage: zgo <plugin-name> <command> [args...]")
	c.output.Info("Example: zgo ai docs user")

	return nil
}
