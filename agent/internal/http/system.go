package httpapi

import (
	"log"
	"net/http"
	"os/exec"
	"time"
)

func registerSystemRoutes(
	mux *http.ServeMux,
) {
	mux.HandleFunc(
		"/api/v1/system/reboot",
		handleSystemReboot,
	)

	mux.HandleFunc(
		"/api/v1/system/shutdown",
		handleSystemShutdown,
	)
}

func handleSystemReboot(
	w http.ResponseWriter,
	r *http.Request,
) {
	handleSystemPower(
		w,
		r,
		"reboot",
	)
}

func handleSystemShutdown(
	w http.ResponseWriter,
	r *http.Request,
) {
	handleSystemPower(
		w,
		r,
		"poweroff",
	)
}

func handleSystemPower(
	w http.ResponseWriter,
	r *http.Request,
	action string,
) {
	if r.Method != http.MethodPost {
		http.Error(
			w,
			"method not allowed",
			http.StatusMethodNotAllowed,
		)

		return
	}

	/*
		The agent is bound to 127.0.0.1.

		The public authenticated boundary is the backend.
		This endpoint is therefore intended only for the
		local backend -> agent communication path.
	*/

	writeJSON(
		w,
		http.StatusAccepted,
		map[string]any{
			"success":  true,
			"action":   action,
			"accepted": true,
		},
	)

	go func() {
		/*
			Allow the HTTP response to leave the process before
			systemd begins shutting down the VPS.
		*/
		time.Sleep(500 * time.Millisecond)

		command := exec.Command(
			"systemctl",
			action,
		)

		if err := command.Run(); err != nil {
			log.Printf(
				"system power operation failed: action=%s error=%v",
				action,
				err,
			)

			return
		}

		log.Printf(
			"system power operation accepted by systemd: action=%s",
			action,
		)
	}()
}
