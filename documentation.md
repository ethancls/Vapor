# Vapor Documentation

## 1. Architecture

Vapor = backend Go + frontend React.

- Backend: HTTP API + WebSocket
- Frontend: bundle Vite (embarqué dans le binaire en prod)
- Hyperviseur: Multipass CLI
- Stockage: SQLite (`VAPOR_DB_PATH`)

## 2. Auth et comptes

Le backend initialise un compte owner par défaut uniquement si la table `users` est vide:

- login: `vapor`
- password: `vap0r`

Ce bootstrap est déclenché au démarrage (`EnsureDefaultOwner(...)` dans `main.go`).

### Important

- Si la DB existe déjà, pas de reset automatique.
- Pour "retrouver" les identifiants par défaut, il faut repartir d'une DB vide (ou resetter le mot de passe via un compte admin/owner existant).

## 3. Environnements

### 3.1 Dev simple (sans Vite HMR)

```bash
npm install --prefix frontend
npm run build --prefix frontend
go run .
```

UI/API servies par le backend sur `http://localhost:8100`.

### 3.2 Dev avec HMR

```bash
make dev
```

- Vite UI: `http://localhost:5173`
- Backend API/WS: `http://localhost:8100`

### 3.3 Build local

```bash
make build
./vapor
```

## 4. Installation prod (systemd)

Exécuter en utilisateur normal (pas root):

```bash
./deploy/install.sh
```

Le script:

1. vérifie `multipass`
2. build frontend + backend
3. installe `/usr/local/bin/vapor`
4. crée `/etc/vapor/vapor.env` si absent
5. installe `/etc/systemd/system/vapor@.service`
6. active `vapor@<user-courant>`

### Vérification service

```bash
systemctl status "vapor@$(id -un)"
journalctl -u "vapor@$(id -un)" -f
```

## 5. Désinstallation

```bash
sudo ./deploy/uninstall.sh
```

Le script:

- stop/disable les unités `vapor@*.service`
- supprime `vapor@.service` (et legacy `vapor.service`)
- recharge systemd

Il conserve volontairement:

- `/etc/vapor/vapor.env`
- `/var/lib/vapor/`

## 6. Configuration runtime

Exemple de base: `deploy/vapor.env.example`.

Variables principales:

- `VAPOR_BIND`
- `VAPOR_SESSION_TTL`
- `VAPOR_JWT_SECRET`
- `VAPOR_MULTIPASS_BINARY`
- `VAPOR_MULTIPASS_TIMEOUT`
- `VAPOR_MULTIPASS_CONCURRENCY`
- `VAPOR_INSTANCES_CACHE_TTL`
- `VAPOR_POLL_INTERVAL`
- `VAPOR_DB_PATH`
- `VAPOR_ACTIVITY_RETENTION`
- `VAPOR_LOG_LEVEL`
- `VAPOR_LOG_FORMAT`
- `VAPOR_FRONTEND_DIR`

### Variables legacy

`VAPOR_UI_USERNAME` et `VAPOR_UI_PASSWORD` ne pilotent plus l'auth actuelle.

## 7. Lancement manuel prod (sans script)

```bash
npm run build --prefix frontend
CGO_ENABLED=0 go build -ldflags="-s -w" -o vapor .

export VAPOR_BIND=0.0.0.0:8100
export VAPOR_DB_PATH=/var/lib/vapor/vapor.db
export VAPOR_JWT_SECRET="$(openssl rand -base64 32)"

./vapor
```

## 8. Troubleshooting

### 8.1 "authentication required"

- Vérifier que tu t'es bien connecté via `/auth/login`
- Vérifier que le cookie de session est présent

### 8.2 "invalid credentials"

- Si premier démarrage sur DB vide: `vapor / vap0r`
- Sinon: identifiants déjà personnalisés en base

### 8.3 Multipass introuvable

- Vérifier `which multipass`
- Ou définir `VAPOR_MULTIPASS_BINARY` (chemin absolu)

### 8.4 Le service ne démarre pas

```bash
journalctl -u "vapor@$(id -un)" -n 200 --no-pager
```

Vérifier aussi:

- droits sur `VAPOR_DB_PATH`
- présence de Multipass dans le PATH du service
- syntaxe du fichier `/etc/vapor/vapor.env`

## 9. Sécurité minimale recommandée

1. Changer immédiatement le mot de passe du compte `vapor`.
2. Définir explicitement `VAPOR_JWT_SECRET` en prod.
3. Exposer Vapor derrière un reverse proxy HTTPS (Nginx/Caddy/Traefik).
4. Restreindre l'accès réseau (LAN/VPN, pas Internet public direct).

## 10. Commandes utiles

```bash
# Dev
make dev

# Build + run local
make build
make run

# Install / uninstall
make install
make uninstall

# Logs / status
make service-status
make logs
```
