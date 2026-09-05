# VPS Panel

A secure multi-user VPS management platform with web-based tmux
sessions and interactive terminal access.

## Architecture

- Frontend: Next.js + React + Tailwind CSS
- Backend: Go
- VPS Agent: Go
- Database: MariaDB
- Terminal: xterm.js
- Communication: HTTPS + WebSocket
- Session management: tmux

## Project Structure

- `agent/` - VPS agent
- `backend/` - Go backend/API
- `frontend/` - Next.js frontend
- `shared/` - Shared definitions
- `docs/` - Architecture and documentation
- `scripts/` - Deployment and utility scripts

## Development Status

Phase 0 - Architecture + Repository
