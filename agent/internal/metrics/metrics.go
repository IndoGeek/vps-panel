package metrics

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type Metrics struct {
	CPUPercent float64 `json:"cpu_percent"`

	MemoryPercent    float64 `json:"memory_percent"`
	MemoryUsedBytes  uint64  `json:"memory_used_bytes"`
	MemoryTotalBytes uint64  `json:"memory_total_bytes"`

	SwapPercent    float64 `json:"swap_percent"`
	SwapUsedBytes  uint64  `json:"swap_used_bytes"`
	SwapTotalBytes uint64  `json:"swap_total_bytes"`

	DiskPercent    float64 `json:"disk_percent"`
	DiskUsedBytes  uint64  `json:"disk_used_bytes"`
	DiskTotalBytes uint64  `json:"disk_total_bytes"`

	Load1  float64 `json:"load_1"`
	Load5  float64 `json:"load_5"`
	Load15 float64 `json:"load_15"`

	UptimeSeconds uint64 `json:"uptime_seconds"`

	NetworkRxBytes uint64 `json:"network_rx_bytes"`
	NetworkTxBytes uint64 `json:"network_tx_bytes"`
}

type cpuSample struct {
	total uint64
	idle  uint64
}

func Collect() (Metrics, error) {
	cpu, err := collectCPU()
	if err != nil {
		return Metrics{}, err
	}

	memory, err := collectMemory()
	if err != nil {
		return Metrics{}, err
	}

	swap, err := collectSwap()
	if err != nil {
		return Metrics{}, err
	}

	disk, err := collectDisk()
	if err != nil {
		return Metrics{}, err
	}

	load1, load5, load15, err := collectLoad()
	if err != nil {
		return Metrics{}, err
	}

	uptime, err := collectUptime()
	if err != nil {
		return Metrics{}, err
	}

	rx, tx, err := collectNetwork()
	if err != nil {
		return Metrics{}, err
	}

	return Metrics{
		CPUPercent: cpu,

		MemoryPercent:    memory.percent,
		MemoryUsedBytes:  memory.used,
		MemoryTotalBytes: memory.total,

		SwapPercent:    swap.percent,
		SwapUsedBytes:  swap.used,
		SwapTotalBytes: swap.total,

		DiskPercent:    disk.percent,
		DiskUsedBytes:  disk.used,
		DiskTotalBytes: disk.total,

		Load1:  load1,
		Load5:  load5,
		Load15: load15,

		UptimeSeconds: uptime,

		NetworkRxBytes: rx,
		NetworkTxBytes: tx,
	}, nil
}

func collectCPU() (float64, error) {
	first, err := readCPUSample()
	if err != nil {
		return 0, err
	}

	// A short interval gives us a real CPU utilization measurement
	// without requiring a persistent sampler inside the agent.
	time.Sleep(100 * time.Millisecond)

	second, err := readCPUSample()
	if err != nil {
		return 0, err
	}

	totalDelta := second.total - first.total
	idleDelta := second.idle - first.idle

	if totalDelta == 0 {
		return 0, nil
	}

	usage := float64(totalDelta-idleDelta) / float64(totalDelta) * 100

	if usage < 0 {
		usage = 0
	}

	if usage > 100 {
		usage = 100
	}

	return usage, nil
}

func readCPUSample() (cpuSample, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return cpuSample{}, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	if !scanner.Scan() {
		if err := scanner.Err(); err != nil {
			return cpuSample{}, err
		}

		return cpuSample{}, fmt.Errorf("failed to read /proc/stat")
	}

	fields := strings.Fields(scanner.Text())

	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuSample{}, fmt.Errorf("invalid /proc/stat CPU line")
	}

	var values []uint64

	for _, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			return cpuSample{}, err
		}

		values = append(values, value)
	}

	var total uint64

	for _, value := range values {
		total += value
	}

	// user, nice, system, idle, iowait, irq, softirq, steal
	var idle uint64

	if len(values) >= 4 {
		idle = values[3]
	}

	if len(values) >= 5 {
		idle += values[4]
	}

	return cpuSample{
		total: total,
		idle:  idle,
	}, nil
}

type memoryStats struct {
	total   uint64
	used    uint64
	percent float64
}

func collectMemory() (memoryStats, error) {
	values, err := readMeminfo()
	if err != nil {
		return memoryStats{}, err
	}

	total := values["MemTotal"]
	available := values["MemAvailable"]

	if total == 0 {
		return memoryStats{}, fmt.Errorf("MemTotal is unavailable")
	}

	if available > total {
		available = total
	}

	used := total - available

	return memoryStats{
		total:   total,
		used:    used,
		percent: float64(used) / float64(total) * 100,
	}, nil
}

type swapStats struct {
	total   uint64
	used    uint64
	percent float64
}

func collectSwap() (swapStats, error) {
	values, err := readMeminfo()
	if err != nil {
		return swapStats{}, err
	}

	total := values["SwapTotal"]
	free := values["SwapFree"]

	if free > total {
		free = total
	}

	used := total - free

	var percent float64

	if total > 0 {
		percent = float64(used) / float64(total) * 100
	}

	return swapStats{
		total:   total,
		used:    used,
		percent: percent,
	}, nil
}

func readMeminfo() (map[string]uint64, error) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	values := make(map[string]uint64)

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())

		if len(fields) < 2 {
			continue
		}

		key := strings.TrimSuffix(fields[0], ":")

		value, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			continue
		}

		// /proc/meminfo values are normally KiB.
		if len(fields) >= 3 && fields[2] == "kB" {
			value *= 1024
		}

		values[key] = value
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return values, nil
}

type diskStats struct {
	total   uint64
	used    uint64
	percent float64
}

func collectDisk() (diskStats, error) {
	var stat syscall.Statfs_t

	if err := syscall.Statfs("/", &stat); err != nil {
		return diskStats{}, err
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

	return diskStats{
		total:   total,
		used:    used,
		percent: percent,
	}, nil
}

func collectLoad() (float64, float64, float64, error) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0, err
	}

	fields := strings.Fields(string(data))

	if len(fields) < 3 {
		return 0, 0, 0, fmt.Errorf("invalid /proc/loadavg")
	}

	load1, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, 0, 0, err
	}

	load5, err := strconv.ParseFloat(fields[1], 64)
	if err != nil {
		return 0, 0, 0, err
	}

	load15, err := strconv.ParseFloat(fields[2], 64)
	if err != nil {
		return 0, 0, 0, err
	}

	return load1, load5, load15, nil
}

func collectUptime() (uint64, error) {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, err
	}

	fields := strings.Fields(string(data))

	if len(fields) == 0 {
		return 0, fmt.Errorf("invalid /proc/uptime")
	}

	seconds, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, err
	}

	return uint64(seconds), nil
}

func collectNetwork() (uint64, uint64, error) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	defer file.Close()

	var rxTotal uint64
	var txTotal uint64

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if !strings.Contains(line, ":") {
			continue
		}

		parts := strings.SplitN(line, ":", 2)

		if len(parts) != 2 {
			continue
		}

		interfaceName := strings.TrimSpace(parts[0])

		// Loopback traffic is not useful for the VPS network card.
		if interfaceName == "lo" {
			continue
		}

		fields := strings.Fields(parts[1])

		if len(fields) < 9 {
			continue
		}

		rx, err := strconv.ParseUint(fields[0], 10, 64)
		if err != nil {
			continue
		}

		tx, err := strconv.ParseUint(fields[8], 10, 64)
		if err != nil {
			continue
		}

		rxTotal += rx
		txTotal += tx
	}

	if err := scanner.Err(); err != nil {
		return 0, 0, err
	}

	return rxTotal, txTotal, nil
}
