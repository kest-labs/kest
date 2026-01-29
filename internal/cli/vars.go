package cli

import (
	"fmt"
	"sort"

	"github.com/kest-lab/kest-cli/internal/config"
	"github.com/kest-lab/kest-cli/internal/storage"
	"github.com/spf13/cobra"
)

var varsCmd = &cobra.Command{
	Use:   "vars",
	Short: "Manage variables",
	RunE: func(cmd *cobra.Command, args []string) error {
		conf, _ := config.LoadConfig()
		store, err := storage.NewStore()
		if err != nil {
			return err
		}

		vars, err := store.GetVariables(conf.ProjectID, conf.ActiveEnv)
		if err != nil {
			return err
		}

		if len(vars) == 0 {
			fmt.Println("No variables found.")
			return nil
		}

		fmt.Printf("Variables for project %s (env: %s):\n", conf.ProjectID, conf.ActiveEnv)

		// Sort keys for consistent output
		keys := make([]string, 0, len(vars))
		for k := range vars {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		for _, k := range keys {
			fmt.Printf("  %s = %s\n", k, vars[k])
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(varsCmd)
}
