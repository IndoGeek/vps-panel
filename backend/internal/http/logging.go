package http

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const (
	logReset  = "\033[0m"
	logCyan   = "\033[36m"
	logYellow = "\033[33m"
	logRed    = "\033[31m"
	logGray   = "\033[90m"
)

type logWriter struct {
	mu   sync.Mutex
	file *os.File
}

func (w *logWriter) Write(
	p []byte,
) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	message := strings.TrimRight(
		string(p),
		"\r\n",
	)

	level := detectLogLevel(
		message,
	)

	color := logCyan

	switch level {
	case "WARN":
		color = logYellow

	case "ERROR":
		color = logRed

	case "DEBUG":
		color = logGray
	}

	plain :=
		"[" +
			level +
			"] " +
			message +
			"\n"

	colored :=
		color +
			"[" +
			level +
			"]" +
			logReset +
			" " +
			message +
			"\n"

	if w.file != nil {
		_, _ = w.file.WriteString(
			plain,
		)
	}

	_, _ = os.Stderr.Write(
		[]byte(colored),
	)

	return len(p), nil
}

func detectLogLevel(
	message string,
) string {
	lower := strings.ToLower(
		message,
	)

	if strings.Contains(
		lower,
		"error",
	) ||
		strings.Contains(
			lower,
			"failed",
		) ||
		strings.Contains(
			lower,
			"failure",
		) ||
		strings.Contains(
			lower,
			"fatal",
		) ||
		strings.Contains(
			lower,
			"panic",
		) ||
		strings.Contains(
			lower,
			"timeout",
		) {
		return "ERROR"
	}

	if strings.Contains(
		lower,
		"warn",
	) ||
		strings.Contains(
			lower,
			"warning",
		) {
		return "WARN"
	}

	if strings.Contains(
		lower,
		"debug",
	) {
		return "DEBUG"
	}

	return "INFO"
}

func init() {
	logDirectory := os.Getenv(
		"VPS_PANEL_LOG_DIR",
	)

	if strings.TrimSpace(
		logDirectory,
	) == "" {
		workingDirectory, err := os.Getwd()

		if err == nil {
			logDirectory = filepath.Join(
				workingDirectory,
				"logs",
			)
		} else {
			logDirectory = "./logs"
		}
	}

	if err := os.MkdirAll(
		logDirectory,
		0755,
	); err != nil {
		return
	}

	file, err := os.OpenFile(
		filepath.Join(
			logDirectory,
			"backend.log",
		),
		os.O_APPEND|
			os.O_CREATE|
			os.O_WRONLY,
		0644,
	)
	if err != nil {
		return
	}

	writer := &logWriter{
		file: file,
	}

	log.SetFlags(
		log.Ldate |
			log.Ltime |
			log.Lmicroseconds,
	)

	log.SetOutput(
		io.Writer(writer),
	)
}
