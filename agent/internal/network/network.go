package network

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"sort"
	"strconv"
	"strings"
)

type Interface struct {
	Name      string   `json:"name"`
	State     string   `json:"state"`
	MAC       string   `json:"mac"`
	MTU       int      `json:"mtu"`
	IPv4      []string `json:"ipv4"`
	IPv6      []string `json:"ipv6"`
	RxBytes   uint64   `json:"rx_bytes"`
	TxBytes   uint64   `json:"tx_bytes"`
	RxPackets uint64   `json:"rx_packets"`
	TxPackets uint64   `json:"tx_packets"`
	Loopback  bool     `json:"loopback"`
}

type interfaceStats struct {
	rxBytes   uint64
	rxPackets uint64
	txBytes   uint64
	txPackets uint64
}

func Collect() ([]Interface, error) {
	stats, err := readStats()
	if err != nil {
		return nil, err
	}

	interfaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}

	result := make([]Interface, 0, len(interfaces))

	for _, iface := range interfaces {
		item := Interface{
			Name:     iface.Name,
			MTU:      iface.MTU,
			Loopback: iface.Flags&net.FlagLoopback != 0,
			IPv4:     []string{},
			IPv6:     []string{},
		}

		switch {
		case item.Loopback:
			item.State = "loopback"
		case iface.Flags&net.FlagUp != 0:
			item.State = "up"
		default:
			item.State = "down"
		}

		if iface.HardwareAddr != nil {
			item.MAC = iface.HardwareAddr.String()
		}

		if ifaceStats, ok := stats[iface.Name]; ok {
			item.RxBytes = ifaceStats.rxBytes
			item.TxBytes = ifaceStats.txBytes
			item.RxPackets = ifaceStats.rxPackets
			item.TxPackets = ifaceStats.txPackets
		}

		addresses, err := iface.Addrs()
		if err == nil {
			for _, address := range addresses {
				ip, _, err := net.ParseCIDR(address.String())
				if err != nil {
					continue
				}

				if ip.To4() != nil {
					item.IPv4 = append(item.IPv4, address.String())
				} else {
					item.IPv6 = append(item.IPv6, address.String())
				}
			}
		}

		sort.Strings(item.IPv4)
		sort.Strings(item.IPv6)

		result = append(result, item)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

	return result, nil
}

func readStats() (map[string]interfaceStats, error) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stats := make(map[string]interfaceStats)

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

		name := strings.TrimSpace(parts[0])
		fields := strings.Fields(parts[1])

		/*
			/proc/net/dev:

			receive:
			bytes packets errs drop fifo frame compressed multicast

			transmit:
			bytes packets errs drop fifo colls carrier compressed

			Therefore:
			fields[0] = RX bytes
			fields[1] = RX packets
			fields[8] = TX bytes
			fields[9] = TX packets
		*/
		if len(fields) < 10 {
			continue
		}

		rxBytes, err := strconv.ParseUint(fields[0], 10, 64)
		if err != nil {
			continue
		}

		rxPackets, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			continue
		}

		txBytes, err := strconv.ParseUint(fields[8], 10, 64)
		if err != nil {
			continue
		}

		txPackets, err := strconv.ParseUint(fields[9], 10, 64)
		if err != nil {
			continue
		}

		stats[name] = interfaceStats{
			rxBytes:   rxBytes,
			rxPackets: rxPackets,
			txBytes:   txBytes,
			txPackets: txPackets,
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("reading /proc/net/dev: %w", err)
	}

	return stats, nil
}
