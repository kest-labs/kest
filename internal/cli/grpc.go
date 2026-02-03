package cli

import (
	"fmt"
	"time"

	"github.com/kest-lab/kest-cli/internal/client"
	"github.com/kest-lab/kest-cli/internal/config"
	"github.com/kest-lab/kest-cli/internal/logger"
	"github.com/kest-lab/kest-cli/internal/output"
	"github.com/kest-lab/kest-cli/internal/storage"
	"github.com/spf13/cobra"
)

var (
	grpcData      string
	grpcProtoPath string
	grpcTimeout   int
	grpcVerbose   bool
)

var grpcCmd = &cobra.Command{
	Use:   "grpc [address] [service/method]",
	Short: "Send a gRPC request",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		addr := args[0]
		method := args[1]

		opts := client.GRPCOptions{
			Address:   addr,
			Method:    method,
			Data:      grpcData,
			ProtoPath: grpcProtoPath,
			Timeout:   time.Duration(grpcTimeout) * time.Second,
		}

		resp, err := client.ExecuteGRPC(opts)
		if err != nil {
			fmt.Printf("❌ gRPC Request Failed: %v\n", err)
			return err
		}

		// Logging
		logger.LogRequest("GRPC", addr+"/"+method, nil, grpcData, 200, nil, string(resp.Data), resp.Duration)

		// Save to history database
		conf, _ := config.LoadConfig()
		store, storeErr := storage.NewStore()
		if storeErr == nil {
			projectID := ""
			env := "default"
			if conf != nil {
				projectID = conf.ProjectID
				env = conf.ActiveEnv
			}

			record := &storage.Record{
				Method:         "GRPC",
				URL:            addr + "/" + method,
				RequestBody:    grpcData,
				ResponseBody:   string(resp.Data),
				ResponseStatus: 200,
				DurationMs:     resp.Duration.Milliseconds(),
				Project:        projectID,
				Environment:    env,
			}
			_, _ = store.SaveRecord(record)
		}

		if grpcVerbose {
			fmt.Printf("\n--- Debug Info ---\n")
			fmt.Printf("Endpoint: %s\n", addr)
			fmt.Printf("Method: %s\n", method)
			fmt.Printf("Data: %s\n", grpcData)
		}

		// Use the same formatter as REST for now, or a specific one if needed
		output.PrintResponse("gRPC", method, 200, resp.Duration.String(), resp.Data, 0, time.Now())
		return nil
	},
}

func init() {
	grpcCmd.Flags().StringVarP(&grpcData, "data", "d", "{}", "JSON data for the gRPC request")
	grpcCmd.Flags().StringVarP(&grpcProtoPath, "proto", "p", "", "Path to .proto file")
	grpcCmd.Flags().IntVarP(&grpcTimeout, "timeout", "t", 10, "Timeout in seconds")
	grpcCmd.Flags().BoolVarP(&grpcVerbose, "verbose", "v", false, "Show detailed debug info")
	rootCmd.AddCommand(grpcCmd)
}
