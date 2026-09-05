package system

import (
	"os"
	"os/exec"
	"strings"
)

type Info struct {
	Hostname     string `json:"hostname"`
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	Kernel       string `json:"kernel"`
}

func GetInfo() (Info, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return Info{}, err
	}

	osName := readOSName()

	kernel, err := commandOutput("uname", "-r")
	if err != nil {
		return Info{}, err
	}

	architecture, err := commandOutput("uname", "-m")
	if err != nil {
		return Info{}, err
	}

	return Info{
		Hostname:     hostname,
		OS:           osName,
		Architecture: architecture,
		Kernel:       kernel,
	}, nil
}

func readOSName() string {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return "Unknown"
	}

	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
		}
	}

	return "Unknown"
}

func commandOutput(command string, args ...string) (string, error) {
	output, err := exec.Command(command, args...).Output()
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(output)), nil
}
