package user

import (
	"github.com/kest-labs/kest/api/internal/domain"
	"github.com/google/wire"
)

// ProviderSet is the provider set for this module
// It binds concrete implementations to domain interfaces
var ProviderSet = wire.NewSet(
	NewRepository,
	wire.Bind(new(domain.UserRepository), new(*repository)),
	NewService,
	wire.Bind(new(Service), new(*service)),
	NewHandler,
)
