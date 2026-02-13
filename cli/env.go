package main

import (
	"fmt"

	"github.com/kest-labs/kest/cli/internal/config"
	"github.com/spf13/cobra"
)

var envCmd = &cobra.Command{
	Use:     "env",
	Aliases: []string{"e"},
	Short:   "Manage environments",
	Long:    "View and switch between configured environments (dev, staging, production, etc.).",
	Example: `  # List all environments
  kest env list

  # Switch to staging
  kest env use staging`,
}

var envListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List all environments",
	Run: func(cmd *cobra.Command, args []string) {
		conf, err := config.LoadConfig()
		if err != nil {
			fmt.Printf("Error loading config: %v\n", err)
			return
		}

		fmt.Println("Available environments:")
		active := conf.ActiveEnv
		for name := range conf.Environments {
			if name == active {
				fmt.Printf("* %s\n", name)
			} else {
				fmt.Printf("  %s\n", name)
			}
		}
	},
}

var envUseCmd = &cobra.Command{
	Use:     "use [env]",
	Short:   "Switch to a different environment",
	Example: `  kest env use staging`,
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		newEnv := args[0]

		conf, err := config.LoadConfig()
		if err != nil {
			return err
		}

		if _, ok := conf.Environments[newEnv]; !ok {
			return fmt.Errorf("environment '%s' not found", newEnv)
		}

		conf.ActiveEnv = newEnv
		if err := config.SaveConfig(conf); err != nil {
			return err
		}

		fmt.Printf("✓ Switched to environment: %s\n", newEnv)
		return nil
	},
}

func init() {
	envCmd.AddCommand(envListCmd)
	envCmd.AddCommand(envUseCmd)
	rootCmd.AddCommand(envCmd)
}
