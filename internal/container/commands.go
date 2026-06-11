package container

var SupportedCommands = map[string]bool{
	"build": true, "copy": true, "create": true, "delete": true, "exec": true,
	"export": true, "inspect": true, "kill": true, "list": true, "logs": true,
	"prune": true, "run": true, "start": true, "stats": true, "stop": true,

	"image delete": true, "image inspect": true, "image list": true,
	"image load": true, "image prune": true, "image pull": true,
	"image push": true, "image save": true, "image tag": true,

	"builder delete": true, "builder start": true, "builder status": true, "builder stop": true,

	"network create": true, "network delete": true, "network inspect": true,
	"network list": true, "network prune": true,

	"volume create": true, "volume delete": true, "volume inspect": true,
	"volume list": true, "volume prune": true,

	"registry list": true, "registry login": true, "registry logout": true,

	"machine create": true, "machine delete": true, "machine inspect": true,
	"machine list": true, "machine logs": true, "machine run": true,
	"machine set": true, "machine set-default": true, "machine stop": true,

	"system df": true, "system logs": true, "system start": true, "system status": true,
	"system stop": true, "system version": true,
	"system dns create": true, "system dns delete": true, "system dns list": true,
	"system kernel set": true, "system property list": true,
}

var MutatingCommands = map[string]bool{
	"build": true, "copy": true, "create": true, "delete": true, "exec": true,
	"export": true, "kill": true, "prune": true, "run": true, "start": true, "stop": true,

	"image delete": true, "image load": true, "image prune": true, "image pull": true,
	"image push": true, "image save": true, "image tag": true,

	"builder delete": true, "builder start": true, "builder stop": true,

	"network create": true, "network delete": true, "network prune": true,

	"volume create": true, "volume delete": true, "volume prune": true,

	"registry login": true, "registry logout": true,

	"machine create": true, "machine delete": true, "machine run": true,
	"machine set": true, "machine set-default": true, "machine stop": true,

	"system start": true, "system stop": true,
	"system dns create": true, "system dns delete": true, "system kernel set": true,
}
