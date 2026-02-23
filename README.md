# Vapor

Dashboard web pour gérer des VM Multipass (instances, snapshots, réseaux, templates, utilisateurs) avec backend Go et frontend React.

## Authentification

Vapor utilise une base utilisateurs locale (`users` dans SQLite), pas `VAPOR_UI_PASSWORD`.

Au premier démarrage sur une base vide (`VAPOR_DB_PATH`):

- Login: `vapor`
- Mot de passe: `vap0r`
- Rôle: `owner`

Important:

- Ces identifiants par défaut ne sont créés qu'une seule fois.
- Si la DB existe déjà, les identifiants sont ceux stockés en base.
- Change le mot de passe immédiatement après le premier login.

## Prérequis

- Linux/macOS avec Multipass installé
- Go 1.22+
- Node.js 18+

## Lancer en local (rapide)

```bash
# 1) Installer les deps frontend
npm install --prefix frontend

# 2) Builder le frontend (nécessaire pour l'embed Go)
npm run build --prefix frontend

# 3) Lancer l'app
go run .
```

Puis ouvrir `http://localhost:8100`.

## Mode développement (backend hot reload + frontend Vite)

```bash
make dev
```

- API backend: `http://localhost:8100`
- UI Vite: `http://localhost:5173`

Le frontend Vite proxy `/api`, `/auth`, `/ws` vers `localhost:8100`.

## Build binaire

```bash
make build
./vapor
```

## Installation systemd (prod)

```bash
./deploy/install.sh
```

Le script:

1. Build frontend + binaire Go
2. Installe `/usr/local/bin/vapor`
3. Crée `/etc/vapor/vapor.env` si absent
4. Installe `vapor@.service`
5. Active `vapor@<user-courant>`

Commandes utiles:

```bash
systemctl status "vapor@$(id -un)"
journalctl -u "vapor@$(id -un)" -f
```

## Désinstallation

```bash
sudo ./deploy/uninstall.sh
```

Le script retire les unités systemd Vapor, mais conserve:

- `/etc/vapor/vapor.env`
- `/var/lib/vapor/`

## Configuration

Variables supportées (voir `internal/config/config.go`):

| Variable | Défaut |
|---|---|
| `VAPOR_BIND` | `0.0.0.0:8100` |
| `VAPOR_SESSION_TTL` | `24h` |
| `VAPOR_JWT_SECRET` | valeur interne par défaut (à changer en prod) |
| `VAPOR_MULTIPASS_BINARY` | `multipass` |
| `VAPOR_MULTIPASS_TIMEOUT` | `45s` |
| `VAPOR_MULTIPASS_CONCURRENCY` | `6` |
| `VAPOR_INSTANCES_CACHE_TTL` | `2s` |
| `VAPOR_POLL_INTERVAL` | `5s` |
| `VAPOR_DB_PATH` | `vapor.db` |
| `VAPOR_ACTIVITY_RETENTION` | `5000` |
| `VAPOR_LOG_LEVEL` | `info` |
| `VAPOR_LOG_FORMAT` | `text` |
| `VAPOR_FRONTEND_DIR` | vide (frontend embarqué) |

Notes:

- `VAPOR_UI_USERNAME` / `VAPOR_UI_PASSWORD` sont des anciens réglages, non utilisés par l'auth actuelle.
- En production, définis `VAPOR_JWT_SECRET` explicitement.

## Documentation détaillée

Voir `documentation.md` pour:

- flux dev/prod complets
- troubleshooting
- checklist sécurité
- commandes d'exploitation
