package container

var SupportedCommands = map[string]bool{
	"alias":        true,
	"aliases":      true,
	"authenticate": true,
	"clone":        true,
	"delete":       true,
	"exec":         true,
	"find":         true,
	"get":          true,
	"help":         true,
	"info":         true,
	"launch":       true,
	"list":         true,
	"mount":        true,
	"networks":     true,
	"prefer":       true,
	"purge":        true,
	"recover":      true,
	"restart":      true,
	"restore":      true,
	"set":          true,
	"shell":        true,
	"snapshot":     true,
	"start":        true,
	"stop":         true,
	"suspend":      true,
	"transfer":     true,
	"umount":       true,
	"unalias":      true,
	"version":      true,
}

var MutatingCommands = map[string]bool{
	"alias":        true,
	"authenticate": true,
	"clone":        true,
	"delete":       true,
	"launch":       true,
	"mount":        true,
	"prefer":       true,
	"purge":        true,
	"recover":      true,
	"restart":      true,
	"restore":      true,
	"set":          true,
	"snapshot":     true,
	"start":        true,
	"stop":         true,
	"suspend":      true,
	"transfer":     true,
	"umount":       true,
	"unalias":      true,
}

// SortedCommands returns the list of supported commands sorted.
func SortedCommands() []string {
	result := make([]string, 0, len(SupportedCommands))
	for cmd := range SupportedCommands {
		result = append(result, cmd)
	}
	// simple sort
	for i := 0; i < len(result); i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i] > result[j] {
				result[i], result[j] = result[j], result[i]
			}
		}
	}
	return result
}
