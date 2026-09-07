package authverify

import (
	"errors"
	"fmt"
	"os/exec"
	"os/user"
	"strings"

	"github.com/msteinert/pam/v2"
)

var (
	ErrInvalidCredentials = errors.New(
		"invalid credentials",
	)

	ErrUserNotFound = errors.New(
		"user not found",
	)
)

type Result struct {
	Authenticated bool
	Sudo          bool
	Username      string
	LinuxUser     string
}

func Verify(
	username string,
	password string,
) (Result, error) {
	username = strings.TrimSpace(username)

	if username == "" ||
		password == "" {
		return Result{
			Authenticated: false,
		}, nil
	}

	if _, err := user.Lookup(username); err != nil {
		return Result{
			Authenticated: false,
		}, nil
	}

	authenticated, err := authenticatePAM(
		username,
		password,
	)
	if err != nil {
		return Result{
			Authenticated: false,
		}, nil
	}

	if !authenticated {
		return Result{
			Authenticated: false,
		}, nil
	}

	sudo, err := isSudoUser(
		username,
	)
	if err != nil {
		return Result{}, fmt.Errorf(
			"failed to inspect sudo privileges: %w",
			err,
		)
	}

	return Result{
		Authenticated: true,
		Sudo:          sudo,
		Username:      username,
		LinuxUser:     username,
	}, nil
}

func authenticatePAM(
	username string,
	password string,
) (bool, error) {
	transaction, err := pam.StartFunc(
		"vps-panel",
		username,
		func(
			style pam.Style,
			message string,
		) (string, error) {
			switch style {
			case pam.PromptEchoOff:
				return password, nil

			case pam.PromptEchoOn:
				return username, nil

			case pam.ErrorMsg:
				return "", nil

			case pam.TextInfo:
				return "", nil

			default:
				return "",
					fmt.Errorf(
						"unsupported PAM conversation style: %v",
						style,
					)
			}
		},
	)
	if err != nil {
		return false, err
	}

	defer transaction.End()

	if err := transaction.Authenticate(
		0,
	); err != nil {
		return false, err
	}

	if err := transaction.AcctMgmt(
		0,
	); err != nil {
		return false, err
	}

	return true, nil
}

func isSudoUser(
	username string,
) (bool, error) {
	command := exec.Command(
		"sudo",
		"-n",
		"-l",
		"-U",
		username,
	)

	output, err := command.CombinedOutput()

	if err == nil {
		return true, nil
	}

	/*
		A non-zero exit status normally means that the
		user is not permitted to use sudo.

		Do not expose sudo's output to the browser.
	*/
	_ = output

	return false, nil
}
