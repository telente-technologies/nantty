package privacy

import (
	"context"
	"net/http"

	"golang.org/x/sync/errgroup"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/modules/accountDeletion"
	"zudomart/modules/users/src/modules/addresses"
	"zudomart/modules/users/src/modules/consents"
	"zudomart/modules/users/src/modules/dataExport"
	"zudomart/modules/users/src/modules/geo"
	"zudomart/modules/users/src/modules/privacySettings"
	"zudomart/modules/users/src/modules/retention"
)

func Mount(mux *http.ServeMux, c *container.Container) {
	geo.Mount(mux, c)
	addresses.Mount(mux, c)
	consents.Mount(mux, c)
	privacysettings.Mount(mux, c)
	dataexport.Mount(mux, c)
	accountdeletion.Mount(mux, c)
	retention.Mount(mux, c)
}

func RunBackgroundWorkersUntilContextDone(ctx context.Context, c *container.Container) error {
	group, groupContext := errgroup.WithContext(ctx)
	group.Go(func() error { return dataexport.RunBackgroundWorkersUntilContextDone(groupContext, c) })
	group.Go(func() error { return accountdeletion.RunBackgroundWorkersUntilContextDone(groupContext, c) })
	return group.Wait()
}

func SeedReferenceData(ctx context.Context, c *container.Container) error {
	for _, seed := range []func(context.Context, *container.Container) error{geo.SeedReferenceData, consents.SeedReferenceData, retention.SeedReferenceData} {
		if err := seed(ctx, c); err != nil {
			return err
		}
	}
	return nil
}
