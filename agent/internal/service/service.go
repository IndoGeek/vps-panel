package service

import (
	"bufio"
	"os/exec"
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
		services[service.Name] = &service
	}

	for _, service := range enabled {
		existing, ok := services[service.Name]

		if !ok {
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

	return result, nil
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

	scanner := bufio.NewScanner(strings.NewReader(string(output)))

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())

		if len(fields) < 4 {
			continue
		}

		name := strings.TrimSuffix(fields[0], ".service")
		active := fields[2] == "active"

		description := strings.Join(fields[4:], " ")

		services = append(services, Service{
			Name:        name,
			Description: description,
			Active:      active,
		})
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

	scanner := bufio.NewScanner(strings.NewReader(string(output)))

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())

		if len(fields) < 2 {
			continue
		}

		name := strings.TrimSuffix(fields[0], ".service")

		if fields[1] != "enabled" {
			continue
		}

		services = append(services, Service{
			Name:    name,
			Enabled: true,
		})
	}

	return services, scanner.Err()
}
