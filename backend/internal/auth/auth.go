package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"sync"
	"time"
)

var (
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrNotSudo             = errors.New("user is not authorized for elevated operations")
	ErrVerifierUnavailable = errors.New("authentication verifier unavailable")
)

type Identity struct {
	Username  string `json:"username"`
	LinuxUser string `json:"linux_user"`
	Sudo      bool   `json:"sudo"`
}

type Verification struct {
	Authenticated bool
	Sudo          bool
	LinuxUser     string
}

type CredentialVerifier interface {
	Verify(username string, password string) (Verification, error)
}

type Config struct {
	CookieName string
	SessionTTL time.Duration
}

type Service struct {
	cfg      Config
	verifier CredentialVerifier

	mu       sync.RWMutex
	sessions map[string]session
}

type session struct {
	identity Identity
	expires  time.Time
}

func New(
	cfg Config,
	verifier CredentialVerifier,
) (*Service, error) {
	if verifier == nil {
		return nil, errors.New(
			"authentication verifier is not configured",
		)
	}

	if cfg.CookieName == "" {
		cfg.CookieName = "vps_panel_session"
	}

	if cfg.SessionTTL <= 0 {
		cfg.SessionTTL = 12 * time.Hour
	}

	return &Service{
		cfg:      cfg,
		verifier: verifier,
		sessions: make(map[string]session),
	}, nil
}

func (s *Service) Login(
	username string,
	password string,
) (Identity, error) {
	if username == "" || password == "" {
		return Identity{}, ErrInvalidCredentials
	}

	result, err := s.verifier.Verify(
		username,
		password,
	)
	if err != nil {
		return Identity{}, err
	}

	if !result.Authenticated {
		return Identity{}, ErrInvalidCredentials
	}

	linuxUser := result.LinuxUser

	if linuxUser == "" {
		linuxUser = username
	}

	return Identity{
		Username:  username,
		LinuxUser: linuxUser,
		Sudo:      result.Sudo,
	}, nil
}

func (s *Service) VerifyElevated(
	identity Identity,
	password string,
) error {
	if password == "" {
		return ErrInvalidCredentials
	}

	result, err := s.verifier.Verify(
		identity.LinuxUser,
		password,
	)
	if err != nil {
		return err
	}

	if !result.Authenticated {
		return ErrInvalidCredentials
	}

	if !result.Sudo {
		return ErrNotSudo
	}

	return nil
}

func (s *Service) CreateSession(
	identity Identity,
) (string, error) {
	buffer := make([]byte, 32)

	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}

	token := hex.EncodeToString(buffer)

	s.mu.Lock()

	s.sessions[token] = session{
		identity: identity,
		expires:  time.Now().Add(s.cfg.SessionTTL),
	}

	s.mu.Unlock()

	return token, nil
}

func (s *Service) SetCookie(
	w http.ResponseWriter,
	token string,
) {
	http.SetCookie(
		w,
		&http.Cookie{
			Name:     s.cfg.CookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   false,
			MaxAge:   int(s.cfg.SessionTTL.Seconds()),
		},
	)
}

func (s *Service) ClearCookie(
	w http.ResponseWriter,
) {
	http.SetCookie(
		w,
		&http.Cookie{
			Name:     s.cfg.CookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
		},
	)
}

func (s *Service) Current(
	r *http.Request,
) (Identity, bool) {
	cookie, err := r.Cookie(
		s.cfg.CookieName,
	)

	if err != nil ||
		cookie.Value == "" {
		return Identity{}, false
	}

	s.mu.RLock()

	current, ok := s.sessions[cookie.Value]

	s.mu.RUnlock()

	if !ok {
		return Identity{}, false
	}

	if time.Now().After(current.expires) {
		s.mu.Lock()

		delete(
			s.sessions,
			cookie.Value,
		)

		s.mu.Unlock()

		return Identity{}, false
	}

	return current.identity, true
}

func (s *Service) Logout(
	r *http.Request,
) {
	cookie, err := r.Cookie(
		s.cfg.CookieName,
	)

	if err != nil ||
		cookie.Value == "" {
		return
	}

	s.mu.Lock()

	delete(
		s.sessions,
		cookie.Value,
	)

	s.mu.Unlock()
}
