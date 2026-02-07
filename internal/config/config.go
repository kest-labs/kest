package config

import (
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type Config struct {
	Version           int                    `yaml:"version" mapstructure:"version"`
	Defaults          Defaults               `yaml:"defaults" mapstructure:"defaults"`
	Environments      map[string]Environment `yaml:"environments" mapstructure:"environments"`
	ActiveEnv         string                 `yaml:"active_env" mapstructure:"active_env"`
	LogEnabled        bool                   `yaml:"log_enabled" mapstructure:"log_enabled"`
	ProjectID         string                 // Relative or absolute path used as ID
	ProjectPath       string                 // Absolute path to the project root
	PlatformURL       string                 `yaml:"platform_url" mapstructure:"platform_url"`
	PlatformToken     string                 `yaml:"platform_token" mapstructure:"platform_token"`
	PlatformProjectID string                 `yaml:"platform_project_id" mapstructure:"platform_project_id"`
	LastSyncTime      string                 `yaml:"last_sync_time" mapstructure:"last_sync_time"`
	AIKey             string                 `yaml:"ai_key" mapstructure:"ai_key"`
	AIModel           string                 `yaml:"ai_model" mapstructure:"ai_model"`
	AIBaseURL         string                 `yaml:"ai_base_url" mapstructure:"ai_base_url"`
}

type Defaults struct {
	Timeout int               `yaml:"timeout" mapstructure:"timeout"`
	Headers map[string]string `yaml:"headers" mapstructure:"headers"`
}

type Environment struct {
	BaseURL   string            `yaml:"base_url" mapstructure:"base_url"`
	Variables map[string]string `yaml:"variables" mapstructure:"variables"`
}

func LoadConfig() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")

	// Global config
	home, _ := os.UserHomeDir()
	v.AddConfigPath(filepath.Join(home, ".kest"))

	// Project detection
	projectRoot, _ := findProjectRoot()
	if projectRoot != "" {
		v.AddConfigPath(filepath.Join(projectRoot, ".kest"))
	}

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var conf Config
	if err := v.Unmarshal(&conf); err != nil {
		return nil, err
	}

	conf.ProjectPath = projectRoot
	if projectRoot != "" {
		conf.ProjectID = filepath.Base(projectRoot)
	}

	return &conf, nil
}

func SaveConfig(conf *Config) error {
	projectRoot, _ := findProjectRoot()
	if projectRoot != "" {
		return SaveToPath(conf, filepath.Join(projectRoot, ".kest", "config.yaml"))
	}

	home, _ := os.UserHomeDir()
	return SaveToPath(conf, filepath.Join(home, ".kest", "config.yaml"))
}

func SaveToPath(conf *Config, configPath string) error {
	v := viper.New()

	// Create directory if not exists
	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return err
	}

	// Set all fields to avoid data loss
	v.Set("version", conf.Version)
	v.Set("active_env", conf.ActiveEnv)
	v.Set("log_enabled", conf.LogEnabled)
	v.Set("defaults", conf.Defaults)
	v.Set("environments", conf.Environments)
	v.Set("platform_url", conf.PlatformURL)
	v.Set("platform_token", conf.PlatformToken)
	v.Set("platform_project_id", conf.PlatformProjectID)
	v.Set("last_sync_time", conf.LastSyncTime)
	v.Set("ai_key", conf.AIKey)
	v.Set("ai_model", conf.AIModel)
	v.Set("ai_base_url", conf.AIBaseURL)

	return v.WriteConfigAs(configPath)
}

func findProjectRoot() (string, error) {
	curr, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		if _, err := os.Stat(filepath.Join(curr, ".kest")); err == nil {
			return curr, nil
		}

		parent := filepath.Dir(curr)
		if parent == curr {
			break
		}
		curr = parent
	}
	return "", nil
}

func (c *Config) GetActiveEnv() Environment {
	if env, ok := c.Environments[c.ActiveEnv]; ok {
		return env
	}
	return Environment{}
}
