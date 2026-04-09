package apispec

import "github.com/google/wire"

// ProviderSet is the Wire provider set for API spec module
var ProviderSet = wire.NewSet(
	NewRepository,
	NewService,
)
