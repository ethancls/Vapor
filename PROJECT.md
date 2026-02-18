Crée une application fullstack de gestion de VMs Multipass sous Linux appelée "MPDash".
Stack
Backend : FastAPI (Python)

FastAPI + uvicorn pour le serveur
subprocess pour exécuter les commandes multipass (multipass list --format json, multipass info <name> --format json, multipass start/stop/delete/launch/suspend <name>, multipass snapshot, multipass shell)
Endpoints REST :

GET /api/instances → liste toutes les VMs avec état, IP, CPU, RAM, disk
GET /api/instances/{name} → détail d'une VM
POST /api/instances/{name}/start
POST /api/instances/{name}/stop
POST /api/instances/{name}/suspend
DELETE /api/instances/{name}
POST /api/instances/launch (body: name, image, cpus, memory, disk)
GET /api/instances/{name}/snapshots
POST /api/instances/{name}/snapshot
GET /api/activity → log des actions récentes (stocké en mémoire ou fichier JSON local)
GET /api/stats → totaux globaux (VMs running, CPUs alloués, RAM totale, disk total)
WebSocket WS /ws/instances → push l'état des VMs toutes les 5 secondes


CORS activé pour localhost:5173
Logging de chaque action dans un fichier activity.json local (timestamp, action, vm_name, statut success/error)

Frontend : React + Vite

React 18 + Vite
Recharts pour les graphiques
Tailwind CSS pour le styling
TanStack React Query pour le fetching et le polling
WebSocket natif pour le live update des états VMs


UI — Dark Premium, accents néon vert
Style global :

Fond : #0a0a0a
Cartes : #111111, #161616, #1c1c1c
Accent primaire : #b5f23d (néon jaune-vert)
Texte principal : #f0f0f0, secondaire : #666
Police : IBM Plex Mono (Google Fonts) pour chiffres/IPs/noms de VMs, Syne pour titres et nav
Coins arrondis : 16px minimum sur toutes les cartes
Animations hover : légère élévation + border accent sur les cartes, highlight sur nav items

Layout :

Sidebar gauche fixe 220px : logo "MPDash" + icône collapse, searchbar pour filtrer VMs, navigation (Dashboard, Instances, Snapshots, Settings), indicateur daemon Multipass en bas (point vert si actif, rouge sinon, vérifié via /api/stats)
Zone principale : header avec titre de page + bouton "+ New Instance" (ouvre modal) + bouton refresh + heure last sync

Page Dashboard :
Carte Overview (accent lime) :

Fond #b5f23d avec sous-carte noire imbriquée
Affiche : total VMs, VMs running, CPUs totaux alloués, RAM totale allouée, disk total utilisé
Bouton "Launch" en bas à droite

Section "My Instances" :

3 premières VMs en cards horizontales : nom VM, image OS, état avec badge coloré (Running = vert #b5f23d, Stopped = rouge #ff4444, Suspended = orange #ff9500), IP address, CPUs, RAM
Menu "..." sur chaque card avec actions contextuelles : Start / Stop / Suspend / Shell / Snapshot / Delete
Barre de distribution RAM entre les VMs running (couleurs distinctes par VM)

Section "Resource Chart" :

Graphique AreaChart recharts montrant l'historique CPU ou RAM de la VM sélectionnée (données collectées côté backend lors des polls WebSocket et stockées en mémoire, max 60 points)
Ligne néon vert sur fond sombre, aire avec gradient transparent vers le bas
Dropdown pour sélectionner la VM et la métrique (CPU % / RAM MB / Disk %)
Tooltip custom : timestamp, valeur, delta vs point précédent

Section "Recent Activity" (colonne droite) :

Feed des dernières actions depuis activity.json groupées par date
Icône par type d'action : ▶ start (vert), ■ stop (rouge), ⏸ suspend (orange), 🗑 delete (gris), 🚀 launch (bleu), 📸 snapshot (violet)
Nom de la VM, action, heure, statut success/error
Filtres : ALL / START / STOP / LAUNCH / SNAPSHOT
Bouton "See all activity"

Modal "New Instance" :

Champs : Instance name, Image (dropdown : ubuntu 22.04, ubuntu 24.04, ubuntu 20.04, debian), CPUs (slider 1-8), Memory (slider 512MB-16GB), Disk (slider 5GB-100GB)
Bouton "Launch" → appelle POST /api/instances/launch → feedback spinner + toast succès/erreur

Page Instances (vue tableau complète) :

Tableau de toutes les VMs avec colonnes : Name, State, IPv4, Image, CPUs, Memory, Disk, Actions
Actions inline : start/stop/suspend/delete/snapshot
Filtre par état (All / Running / Stopped / Suspended)


Structure de fichiers attendue
mpdash/
├── backend/
│   ├── main.py          # FastAPI app, tous les endpoints et WebSocket
│   ├── multipass.py     # Wrapper subprocess pour les commandes multipass
│   ├── activity.py      # Logger d'activité (lecture/écriture activity.json)
│   ├── stats.py         # Agrégation des stats globales
│   └── activity.json    # Fichier log persistant
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── OverviewCard.jsx
│   │   │   ├── InstanceCard.jsx
│   │   │   ├── ResourceChart.jsx
│   │   │   ├── ActivityFeed.jsx
│   │   │   ├── NewInstanceModal.jsx
│   │   │   └── InstancesTable.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   └── Instances.jsx
│   │   ├── hooks/
│   │   │   ├── useInstances.js   # React Query + WebSocket
│   │   │   └── useActivity.js
│   │   ├── api/
│   │   │   └── client.js         # fetch wrapper vers FastAPI
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
├── docker-compose.yml
└── README.md
docker-compose.yml

Service backend : image Python 3.11, monte le binary multipass en volume, expose port 8000
Service frontend : image Node 20, expose port 5173 en dev (ou nginx en prod sur port 80)
Réseau bridge commun

Génère l'intégralité du code de chaque fichier, fonctionnel et prêt à lancer.