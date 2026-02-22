package example

import (
	"github.com/google/wire"
)

// ProviderSet is the provider set for example module
var ProviderSet = wire.NewSet(
	NewRepository,
	NewService,
	NewHandler,
)
