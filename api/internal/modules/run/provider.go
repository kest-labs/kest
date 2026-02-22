package run

import (
	"github.com/google/wire"
	"github.com/kest-labs/kest/api/internal/contracts"
)

var ProviderSet = wire.NewSet(
	NewHandler,
	wire.Bind(new(contracts.Module), new(*Handler)),
)
