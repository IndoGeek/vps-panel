package auth

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type Identity struct {
	Username  string `json:"username"`
	LinuxUser string `json:"linux_user"`
}

type Config struct {
	Username     string
	PasswordHash string
	LinuxUser    string
	CookieName   string
	SessionTTL   time.Duration
}

type Service struct {
	cfg      Config
	mu       sync.RWMutex
	sessions map[string]session
}

type session struct {
	identity Identity
	expires  time.Time
}

func New(cfg Config) (*Service, error) {
	if cfg.Username == "" {
		return nil, errors.New("authentication username is not configured")
	}

	if cfg.PasswordHash == "" {
		return nil, errors.New("authentication password hash is not configured")
	}

	if cfg.LinuxUser == "" {
		return nil, errors.New("authentication linux user is not configured")
	}

	if _, err := bcrypt.Cost([]byte(cfg.PasswordHash)); err != nil {
		return nil, errors.New("authentication password hash is invalid")
	}

	if cfg.CookieName == "" {
		cfg.CookieName = "vps_panel_session"
	}

	if cfg.SessionTTL <= 0 {
		cfg.SessionTTL = 12 * time.Hour
	}

	return &Service{
		cfg:      cfg,
		sessions: make(map[string]session),
	}, nil
}

func (s *Service) Login(username, password string) (Identity, error) {
	if username != s.cfg.Username {
		return Identity{}, errors.New("invalid credentials")
	}

	if bcrypt.CompareHashAndPassword(
		[]byte(s.cfg.PasswordHash),
		[]byte(password),
	) != nil {
		return Identity{}, errors.New("invalid credentials")
	}

	return Identity{
		Username:  username,
		LinuxUser: s.cfg.LinuxUser,
	}, nil
}

func (s *Service) CreateSession(identity Identity) (string, error) {
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

func (s *Service) SetCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   false,
		MaxAge:   int(s.cfg.SessionTTL.Seconds()),
	})
}

func (s *Service) ClearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cfg.CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func (s *Service) Current(r *http.Request) (Identity, bool) {
	cookie, err := r.Cookie(s.cfg.CookieName)

	if err != nil || cookie.Value == "" {
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
		delete(s.sessions, cookie.Value)
		s.mu.Unlock()

		return Identity{}, false
	}

	return current.identity, true
}

func (s *Service) Logout(r *http.Request) {
	cookie, err := r.Cookie(s.cfg.CookieName)

	if err != nil || cookie.Value == "" {
		return
	}

	s.mu.Lock()
	delete(s.sessions, cookie.Value)
	s.mu.Unlock()
}
