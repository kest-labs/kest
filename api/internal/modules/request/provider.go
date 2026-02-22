package request

import (
	"github.com/google/wire"
)

// ProviderSet is the provider set for request module
var ProviderSet = wire.NewSet(
	NewRepository,
	NewService,
	NewHandler,
)
