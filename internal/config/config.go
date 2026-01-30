package config

import (
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type Config struct {
	Version      int                    `yaml:"version" mapstructure:"version"`
	Defaults     Defaults               `yaml:"defaults" mapstructure:"defaults"`
	Environments map[string]Environment `yaml:"environments" mapstructure:"environments"`
	ActiveEnv    string                 `yaml:"active_env" mapstructure:"active_env"`
	LogEnabled   bool                   `yaml:"log_enabled" mapstructure:"log_enabled"`
	ProjectID    string                 // Relative or absolute path used as ID
	ProjectPath  string                 // Absolute path to the project root
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
