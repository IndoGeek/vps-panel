package agent

import (
	"github.com/tanmay/vps-panel/agent/internal/identity"
	"github.com/tanmay/vps-panel/agent/internal/metrics"
	"github.com/tanmay/vps-panel/agent/internal/network"
	"github.com/tanmay/vps-panel/agent/internal/process"
	"github.com/tanmay/vps-panel/agent/internal/service"
	"github.com/tanmay/vps-panel/agent/internal/storage"
	"github.com/tanmay/vps-panel/agent/internal/system"
	"github.com/tanmay/vps-panel/agent/internal/tmux"
)

type Snapshot struct {
	System      system.Info
	Metrics     metrics.Metrics
	Network     []network.Interface
	Filesystems []storage.Filesystem
	Users       []identity.User
	Sessions    []tmux.Session
	Processes   []process.Process
	Services    []service.Service
}

func Collect() (*Snapshot, error) {
	info, err := system.GetInfo()
	if err != nil {
		return nil, err
	}

	systemMetrics, err := metrics.Collect()
	if err != nil {
		return nil, err
	}

	networkInterfaces, err := network.Collect()
	if err != nil {
		return nil, err
	}

	filesystems, err := storage.Collect()
	if err != nil {
		return nil, err
	}

	users, err := identity.ListInteractiveUsers()
	if err != nil {
		return nil, err
	}

	sessions, err := tmux.ListSessions()
	if err != nil {
		return nil, err
	}

	processes, err := process.ListProcesses()
	if err != nil {
		return nil, err
	}

	services, err := service.ListServices()
	if err != nil {
		return nil, err
	}

	return &Snapshot{
		System:      info,
		Metrics:     systemMetrics,
		Network:     networkInterfaces,
		Filesystems: filesystems,
		Users:       users,
		Sessions:    sessions,
		Processes:   processes,
		Services:    services,
	}, nil
}
