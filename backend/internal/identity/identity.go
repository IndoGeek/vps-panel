package identity

import (
	"fmt"
	"os/user"
	"strconv"
)

type LinuxUser struct {
	Username string `json:"username"`
	UID      int    `json:"uid"`
	GID      int    `json:"gid"`
	HomeDir  string `json:"home_dir"`
}

func Lookup(username string) (LinuxUser, error) {
	systemUser, err := user.Lookup(username)
	if err != nil {
		return LinuxUser{}, fmt.Errorf(
			"lookup linux user %q: %w",
			username,
			err,
		)
	}

	uid, err := strconv.Atoi(systemUser.Uid)
	if err != nil {
		return LinuxUser{}, fmt.Errorf(
			"invalid uid for %q: %w",
			username,
			err,
		)
	}

	gid, err := strconv.Atoi(systemUser.Gid)
	if err != nil {
		return LinuxUser{}, fmt.Errorf(
			"invalid gid for %q: %w",
			username,
			err,
		)
	}

	return LinuxUser{
		Username: systemUser.Username,
		UID:      uid,
		GID:      gid,
		HomeDir:  systemUser.HomeDir,
	}, nil
}
