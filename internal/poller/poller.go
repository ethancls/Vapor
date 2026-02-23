package poller

import (
	"context"
	"log/slog"
	"time"

	"github.com/user/vapor/internal/multipass"
	"github.com/user/vapor/internal/store"
)

// BroadcastFn is called whenever fresh instance data is available.
type BroadcastFn func(instances []map[string]any)

// Poller periodically polls multipass instances and broadcasts updates.
type Poller struct {
	client    *multipass.Client
	metrics   *store.MetricsStore
	interval  time.Duration
	broadcast BroadcastFn
	logger    *slog.Logger
}

// New creates a Poller.
func New(client *multipass.Client, metrics *store.MetricsStore, interval time.Duration, broadcast BroadcastFn, logger *slog.Logger) *Poller {
	return &Poller{
		client:    client,
		metrics:   metrics,
		interval:  interval,
		broadcast: broadcast,
		logger:    logger,
	}
}

// Run starts the polling loop. It blocks until ctx is cancelled.
func (p *Poller) Run(ctx context.Context) {
	// Poll immediately on start
	p.poll(ctx)

	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.poll(ctx)
		}
	}
}

func (p *Poller) poll(ctx context.Context) {
	instances, err := p.client.GetAllInstancesInfo(ctx, false)
	if err != nil {
		p.logger.Debug("poller: failed to get instances", "err", err)
		// broadcast empty list so WS clients stay connected
		instances = []map[string]any{}
	}
	p.metrics.AppendInstances(instances)
	if p.broadcast != nil {
		p.broadcast(instances)
	}
}
