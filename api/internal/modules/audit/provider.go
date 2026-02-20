package audit

import (
	"github.com/google/wire"
)

// ProviderSet is the Wire provider set for audit module
var ProviderSet = wire.NewSet(
	NewRepository,
	NewHandler,
)
