package collection

import (
	"github.com/google/wire"
)

// ProviderSet is the provider set for collection module
var ProviderSet = wire.NewSet(
	NewRepository,
	NewService,
	NewHandler,
)
