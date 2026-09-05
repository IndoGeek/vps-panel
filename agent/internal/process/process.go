package process

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Process struct {
	PID     int    `json:"pid"`
	PPID    int    `json:"ppid"`
	UID     int    `json:"uid"`
	State   string `json:"state"`
	Command string `json:"command"`
}

func ListProcesses() ([]Process, error) {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return nil, err
	}

	var processes []Process

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		pid, err := strconv.Atoi(entry.Name())
		if err != nil {
			continue
		}

		process, err := readProcess(pid)
		if err != nil {
			// Processes can disappear while we're scanning /proc.
			continue
		}

		processes = append(processes, process)
	}

	return processes, nil
}

func readProcess(pid int) (Process, error) {
	statusPath := filepath.Join("/proc", strconv.Itoa(pid), "status")

	data, err := os.ReadFile(statusPath)
	if err != nil {
		return Process{}, err
	}

	values := make(map[string]string)

	for _, line := range strings.Split(string(data), "\n") {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		key := parts[0]
		value := strings.TrimSpace(parts[1])

		values[key] = value
	}

	ppid, err := strconv.Atoi(values["PPid"])
	if err != nil {
		return Process{}, err
	}

	uidParts := strings.Fields(values["Uid"])
	if len(uidParts) == 0 {
		return Process{}, strconv.ErrSyntax
	}

	uid, err := strconv.Atoi(uidParts[0])
	if err != nil {
		return Process{}, err
	}

	state := values["State"]

	commandData, err := os.ReadFile(
		filepath.Join("/proc", strconv.Itoa(pid), "cmdline"),
	)
	if err != nil {
		return Process{}, err
	}

	command := strings.ReplaceAll(string(commandData), "\x00", " ")
	command = strings.TrimSpace(command)

	if command == "" {
		command = values["Name"]
	}

	return Process{
		PID:     pid,
		PPID:    ppid,
		UID:     uid,
		State:   state,
		Command: command,
	}, nil
}
