package process

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

type Process struct {
	PID           int     `json:"pid"`
	PPID          int     `json:"ppid"`
	UID           int     `json:"uid"`
	User          string  `json:"user"`
	State         string  `json:"state"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float64 `json:"memory_percent"`
	MemoryBytes   uint64  `json:"memory_bytes"`
	Command       string  `json:"command"`
}

func ListProcesses() ([]Process, error) {
	command := exec.Command(
		"ps",
		"-eo",
		"pid=,ppid=,uid=,user=,state=,pcpu=,pmem=,rss=,args=",
		"--sort=-pcpu",
	)

	output, err := command.Output()
	if err != nil {
		return nil, err
	}

	var processes []Process

	for _, line := range strings.Split(
		string(output),
		"\n",
	) {
		fields := strings.Fields(line)

		if len(fields) < 8 {
			continue
		}

		pid, err := strconv.Atoi(fields[0])
		if err != nil {
			continue
		}

		ppid, err := strconv.Atoi(fields[1])
		if err != nil {
			continue
		}

		uid, err := strconv.Atoi(fields[2])
		if err != nil {
			continue
		}

		cpuPercent, err := strconv.ParseFloat(
			fields[5],
			64,
		)
		if err != nil {
			cpuPercent = 0
		}

		memoryPercent, err := strconv.ParseFloat(
			fields[6],
			64,
		)
		if err != nil {
			memoryPercent = 0
		}

		rssKiB, err := strconv.ParseUint(
			fields[7],
			10,
			64,
		)
		if err != nil {
			rssKiB = 0
		}

		commandText := strings.TrimSpace(
			strings.Join(
				fields[8:],
				" ",
			),
		)

		if commandText == "" {
			commandText = "[unknown]"
		}

		processes = append(
			processes,
			Process{
				PID:           pid,
				PPID:          ppid,
				UID:           uid,
				User:          fields[3],
				State:         fields[4],
				CPUPercent:    cpuPercent,
				MemoryPercent: memoryPercent,
				MemoryBytes:   rssKiB * 1024,
				Command:       commandText,
			},
		)
	}

	return processes, nil
}

func KillProcess(
	pid int,
	signalName string,
) error {
	if pid <= 1 {
		return fmt.Errorf(
			"refusing to kill protected PID %d",
			pid,
		)
	}

	if pid == os.Getpid() {
		return fmt.Errorf(
			"refusing to kill the VPS Panel agent",
		)
	}

	var signal os.Signal

	switch strings.ToUpper(
		strings.TrimSpace(signalName),
	) {
	case "", "TERM", "SIGTERM":
		signal = syscall.SIGTERM

	case "KILL", "SIGKILL":
		signal = syscall.SIGKILL

	default:
		return fmt.Errorf(
			"unsupported process signal: %s",
			signalName,
		)
	}

	target, err := os.FindProcess(pid)
	if err != nil {
		return fmt.Errorf(
			"find process %d: %w",
			pid,
			err,
		)
	}

	if err := target.Signal(signal); err != nil {
		return fmt.Errorf(
			"signal process %d failed: %w",
			pid,
			err,
		)
	}

	return nil
}
