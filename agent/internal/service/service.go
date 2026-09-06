package service

import (
	"bufio"
	"fmt"
	"os/exec"
	"sort"
	"strings"
)

type Service struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Active      bool   `json:"active"`
	Enabled     bool   `json:"enabled"`
}

func ListServices() ([]Service, error) {
	active, err := listActiveServices()
	if err != nil {
		return nil, err
	}

	enabled, err := listEnabledServices()
	if err != nil {
		return nil, err
	}

	services := make(map[string]*Service)

	for _, service := range active {
		service := service
		services[service.Name] = &service
	}

	for _, service := range enabled {
		existing, ok := services[service.Name]

		if !ok {
			service := service
			services[service.Name] = &service
			continue
		}

		existing.Enabled = true

		if existing.Description == "" {
			existing.Description = service.Description
		}
	}

	result := make([]Service, 0, len(services))

	for _, service := range services {
		result = append(result, *service)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	return result, nil
}

func ManageService(name string, action string) error {
	name = normalizeServiceName(name)

	if name == "" {
		return fmt.Errorf("service name is required")
	}

	switch action {
	case "start", "stop", "restart", "enable", "disable":
	default:
		return fmt.Errorf("unsupported service action: %s", action)
	}

	command := exec.Command(
		"systemctl",
		action,
		name,
	)

	output, err := command.CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))

		if message == "" {
			message = err.Error()
		}

		return fmt.Errorf(
			"systemctl %s %s failed: %s",
			action,
			name,
			message,
		)
	}

	return nil
}

func normalizeServiceName(name string) string {
	name = strings.TrimSpace(name)

	if name == "" {
		return ""
	}

	if !strings.HasSuffix(name, ".service") {
		name += ".service"
	}

	if len(name) > 256 ||
		strings.ContainsAny(
			name,
			"\x00/\\\t\r\n ",
		) {
		return ""
	}

	return name
}

func listActiveServices() ([]Service, error) {
	cmd := exec.Command(
		"systemctl",
		"list-units",
		"--type=service",
		"--all",
		"--no-legend",
		"--no-pager",
	)

	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var services []Service

	scanner := bufio.NewScanner(
		strings.NewReader(string(output)),
	)

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())

		if len(fields) < 4 {
			continue
		}

		name := strings.TrimSuffix(
			fields[0],
			".service",
		)

		active := fields[2] == "active"

		description := ""

		if len(fields) >= 5 {
			description = strings.Join(
				fields[4:],
				" ",
			)
		}

		services = append(
			services,
			Service{
				Name:        name,
				Description: description,
				Active:      active,
			},
		)
	}

	return services, scanner.Err()
}

func listEnabledServices() ([]Service, error) {
	cmd := exec.Command(
		"systemctl",
		"list-unit-files",
		"--type=service",
		"--no-legend",
		"--no-pager",
	)

	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var services []Service

	scanner := bufio.NewScanner(
		strings.NewReader(string(output)),
	)

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())

		if len(fields) < 2 {
			continue
		}

		name := strings.TrimSuffix(
			fields[0],
			".service",
		)

		if fields[1] != "enabled" {
			continue
		}

		services = append(
			services,
			Service{
				Name:    name,
				Enabled: true,
			},
		)
	}

	return services, scanner.Err()
}
