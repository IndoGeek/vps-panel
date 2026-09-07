package storage

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strings"
	"syscall"
)

type Filesystem struct {
	Device         string  `json:"device"`
	MountPoint     string  `json:"mount_point"`
	Type           string  `json:"type"`
	TotalBytes     uint64  `json:"total_bytes"`
	UsedBytes      uint64  `json:"used_bytes"`
	AvailableBytes uint64  `json:"available_bytes"`
	UsedPercent    float64 `json:"used_percent"`
	ReadOnly       bool    `json:"read_only"`
}

var pseudoFilesystems = map[string]bool{
	"autofs":      true,
	"binfmt_misc": true,
	"bpf":         true,
	"cgroup":      true,
	"cgroup2":     true,
	"configfs":    true,
	"debugfs":     true,
	"devpts":      true,
	"devtmpfs":    true,
	"fusectl":     true,
	"hugetlbfs":   true,
	"mqueue":      true,
	"proc":        true,
	"pstore":      true,
	"ramfs":       true,
	"securityfs":  true,
	"sysfs":       true,
	"tracefs":     true,
}

func Collect() ([]Filesystem, error) {
	file, err := os.Open("/proc/self/mountinfo")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	filesystems := make([]Filesystem, 0)
	seenMountPoints := make(map[string]bool)

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		filesystem, ok := parseMountInfoLine(scanner.Text())
		if !ok {
			continue
		}

		if pseudoFilesystems[filesystem.Type] {
			continue
		}

		if filesystem.MountPoint == "" {
			continue
		}

		if seenMountPoints[filesystem.MountPoint] {
			continue
		}

		var stat syscall.Statfs_t

		if err := syscall.Statfs(filesystem.MountPoint, &stat); err != nil {
			continue
		}

		blockSize := uint64(stat.Bsize)

		total := stat.Blocks * blockSize
		available := stat.Bavail * blockSize

		if available > total {
			available = total
		}

		used := total - available

		var percent float64

		if total > 0 {
			percent = float64(used) / float64(total) * 100
		}

		filesystem.TotalBytes = total
		filesystem.UsedBytes = used
		filesystem.AvailableBytes = available
		filesystem.UsedPercent = percent

		seenMountPoints[filesystem.MountPoint] = true

		filesystems = append(filesystems, filesystem)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("reading /proc/self/mountinfo: %w", err)
	}

	sort.Slice(filesystems, func(i, j int) bool {
		if filesystems[i].MountPoint == "/" {
			return true
		}

		if filesystems[j].MountPoint == "/" {
			return false
		}

		return filesystems[i].MountPoint < filesystems[j].MountPoint
	})

	return filesystems, nil
}

func parseMountInfoLine(line string) (Filesystem, bool) {
	parts := strings.SplitN(line, " - ", 2)

	if len(parts) != 2 {
		return Filesystem{}, false
	}

	mountFields := strings.Fields(parts[0])
	filesystemFields := strings.Fields(parts[1])

	/*
		mountinfo layout:

		0 mount ID
		1 parent ID
		2 major:minor
		3 root
		4 mount point
		5 mount options
		6+ optional fields

		After " - ":

		0 filesystem type
		1 mount source
		2 super options
	*/
	if len(mountFields) < 6 || len(filesystemFields) < 3 {
		return Filesystem{}, false
	}

	mountPoint := decodeMountPath(mountFields[4])

	mountOptions := strings.Split(mountFields[5], ",")

	readOnly := false

	for _, option := range mountOptions {
		if option == "ro" {
			readOnly = true
			break
		}
	}

	return Filesystem{
		Device:     filesystemFields[1],
		MountPoint: mountPoint,
		Type:       filesystemFields[0],
		ReadOnly:   readOnly,
	}, true
}

func decodeMountPath(value string) string {
	return strings.NewReplacer(
		"\\040", " ",
		"\\011", "\t",
		"\\012", "\n",
		"\\\\", "\\",
	).Replace(value)
}
