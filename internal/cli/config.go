package cli

import (
	"fmt"
	"strings"

	"github.com/kest-labs/kest/internal/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config [action] [key] [value]",
	Short: "Manage Kest CLI configuration",
	Long:  `View or update Kest CLI configuration settings like AI keys and platform tokens.`,
	Example: `  # View current config
  kest config list

  # Set AI configuration for Qwen
  kest config set ai_key sk-xxxx...
  kest config set ai_model qwen-max
  kest config set ai_base_url https://dashscope.aliyuncs.com/compatible-mode/v1/`,
}

var configSetCmd = &cobra.Command{
	Use:   "set [key] [value]",
	Short: "Set a configuration value",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		conf, err := config.LoadConfig()
		if err != nil {
			return err
		}

		key := strings.ToLower(args[0])
		value := args[1]

		switch key {
		case "ai_key":
			conf.AIKey = value
		case "ai_model":
			conf.AIModel = value
		case "ai_base_url":
			conf.AIBaseURL = value
		case "platform_url":
			conf.PlatformURL = value
		case "platform_token":
			conf.PlatformToken = value
		default:
			return fmt.Errorf("unknown config key: %s", key)
		}

		if err := config.SaveConfig(conf); err != nil {
			return err
		}

		fmt.Printf("✅ Success: %s has been set.\n", key)
		return nil
	},
}

var configListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all configuration values",
	RunE: func(cmd *cobra.Command, args []string) error {
		conf, err := config.LoadConfig()
		if err != nil {
			return err
		}

		fmt.Println("📋 Current Configuration:")
		fmt.Printf("  ai_key:       %s\n", mask(conf.AIKey))
		fmt.Printf("  ai_model:     %s\n", conf.AIModel)
		fmt.Printf("  ai_base_url:  %s\n", conf.AIBaseURL)
		fmt.Printf("  platform_url: %s\n", conf.PlatformURL)
		fmt.Printf("  active_env:   %s\n", conf.ActiveEnv)

		return nil
	},
}

func mask(s string) string {
	if len(s) <= 8 {
		return "****"
	}
	return s[:4] + "...." + s[len(s)-4:]
}

func init() {
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configListCmd)
	rootCmd.AddCommand(configCmd)
}
