package workspace

import "github.com/google/wire"

// ProviderSet is the Wire provider set for workspace module.
var ProviderSet = wire.NewSet(
	NewRepository,
	NewService,
	NewHandler,
)
