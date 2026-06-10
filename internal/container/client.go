package container

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var sizeRe = regexp.MustCompile(`(?i)^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]*)\s*$`)

// ansiRe strips ANSI escape sequences; spinnerRe strips multipass ASCII spinner chars (/-\|).
var (
	ansiRe    = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)
	spinnerRe = regexp.MustCompile(`[-/\\|]{2,}`)
)

// cleanOutput removes terminal noise from multipass output:
// ANSI codes, CR-overwrite sequences, and spinner characters (/-\|).
func cleanOutput(s string) string {
	s = ansiRe.ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "\r\n", "\n")
	lines := strings.Split(s, "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		// CR overwriting: keep only text after the last \r
		if cr := strings.LastIndexByte(line, '\r'); cr >= 0 {
			line = line[cr+1:]
		}
		line = spinnerRe.ReplaceAllString(line, "")
		line = strings.TrimSpace(line)
		if line != "" {
			result = append(result, line)
		}
	}
	return strings.Join(result, "\n")
}

var sizeMultipliers = map[string]int64{
	"":    1,
	"b":   1,
	"k":   1000, "kb": 1000, "ki": 1024, "kib": 1024,
	"m":   1000 * 1000, "mb": 1000 * 1000, "mi": 1024 * 1024, "mib": 1024 * 1024,
	"g":   1000 * 1000 * 1000, "gb": 1000 * 1000 * 1000, "gi": 1024 * 1024 * 1024, "gib": 1024 * 1024 * 1024,
	"t":   1e12, "tb": 1e12, "ti": 1 << 40, "tib": 1 << 40,
	"p":   1e15, "pb": 1e15, "pi": 1 << 50, "pib": 1 << 50,
}

// CommandError is returned when a multipass command fails.
type CommandError struct {
	Message  string
	Argv     []string
	ExitCode int
	Stdout   string
	Stderr   string
}

func (e *CommandError) Error() string { return e.Message }

// CommandResult holds the output of a multipass command.
type CommandResult struct {
	Argv       []string
	ExitCode   int
	Stdout     string
	Stderr     string
	DurationMs int64
}

// Client is an async-like wrapper around the multipass binary.
type Client struct {
	binary      string
	timeout     time.Duration
	semaphore   chan struct{}
	logger      *slog.Logger

	cacheMu      sync.Mutex
	instancesCache      []map[string]any
	instancesCacheExpiry time.Time
	instancesCacheTTL    time.Duration

	configCacheMu  sync.Mutex
	configCache    map[string]configCacheEntry
	configCacheTTL time.Duration
}

type configCacheEntry struct {
	expiry time.Time
	data   map[string]int64
}

func NewClient(binary string, timeout, cacheTTL time.Duration, concurrency int, logger *slog.Logger) *Client {
	sem := make(chan struct{}, max(1, concurrency))
	return &Client{
		binary:            binary,
		timeout:           timeout,
		semaphore:         sem,
		logger:            logger,
		instancesCacheTTL: cacheTTL,
		configCacheTTL:    10 * time.Second,
		configCache:       make(map[string]configCacheEntry),
	}
}

// InvalidateCache clears the instances cache.
func (c *Client) InvalidateCache() {
	c.cacheMu.Lock()
	c.instancesCache = nil
	c.instancesCacheExpiry = time.Time{}
	c.cacheMu.Unlock()

	c.configCacheMu.Lock()
	c.configCache = make(map[string]configCacheEntry)
	c.configCacheMu.Unlock()
}

// DaemonRunning checks if the multipass daemon is responsive.
func (c *Client) DaemonRunning(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	res, err := c.Run(ctx, "version", nil, nil, "")
	if err != nil {
		return false
	}
	return res.ExitCode == 0
}

// CommandHelp returns the help text for a multipass command.
func (c *Client) CommandHelp(ctx context.Context, command string) (string, error) {
	if !SupportedCommands[command] {
		return "", &CommandError{Message: "unsupported multipass command: " + command, Argv: []string{c.binary, command}}
	}
	res, err := c.RunChecked(ctx, "help", []string{command}, nil, "")
	if err != nil {
		return "", err
	}
	return res.Stdout, nil
}

// Run executes a multipass command (no error on non-zero exit).
func (c *Client) Run(ctx context.Context, command string, args []string, options map[string]any, stdin string) (*CommandResult, error) {
	if !SupportedCommands[command] {
		return nil, &CommandError{
			Message:  "unsupported multipass command: " + command,
			Argv:     []string{c.binary, command},
			ExitCode: -1,
		}
	}

	argv := c.buildArgv(command, args, options)

	// acquire semaphore
	select {
	case c.semaphore <- struct{}{}:
	case <-ctx.Done():
		return nil, &CommandError{Message: "context cancelled waiting for semaphore", Argv: argv, ExitCode: -1}
	}
	defer func() { <-c.semaphore }()

	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	cmd := exec.CommandContext(timeoutCtx, argv[0], argv[1:]...)
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	start := time.Now()
	runErr := cmd.Run()
	durationMs := time.Since(start).Milliseconds()

	exitCode := 0
	if runErr != nil {
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else if timeoutCtx.Err() != nil {
			return nil, &CommandError{
				Message:  fmt.Sprintf("multipass command timed out after %s", c.timeout),
				Argv:     argv,
				ExitCode: 124,
			}
		} else {
			return nil, &CommandError{
				Message:  "multipass binary not found or failed to start: " + runErr.Error(),
				Argv:     argv,
				ExitCode: 127,
			}
		}
	}

	return &CommandResult{
		Argv:       argv,
		ExitCode:   exitCode,
		Stdout:     cleanOutput(stdout.String()),
		Stderr:     cleanOutput(stderr.String()),
		DurationMs: durationMs,
	}, nil
}

// RunChecked is like Run but returns an error if the exit code is non-zero.
func (c *Client) RunChecked(ctx context.Context, command string, args []string, options map[string]any, stdin string) (*CommandResult, error) {
	res, err := c.Run(ctx, command, args, options, stdin)
	if err != nil {
		return nil, err
	}
	if res.ExitCode != 0 {
		msg := res.Stderr
		if msg == "" {
			msg = res.Stdout
		}
		if msg == "" {
			msg = fmt.Sprintf("multipass %s failed (exit %d)", command, res.ExitCode)
		}
		return nil, &CommandError{
			Message:  msg,
			Argv:     res.Argv,
			ExitCode: res.ExitCode,
			Stdout:   res.Stdout,
			Stderr:   res.Stderr,
		}
	}
	return res, nil
}

// RunJSONChecked runs a command, checks exit code, and parses JSON output.
func (c *Client) RunJSONChecked(ctx context.Context, command string, args []string, options map[string]any) (*CommandResult, any, error) {
	res, err := c.RunChecked(ctx, command, args, options, "")
	if err != nil {
		return nil, nil, err
	}
	var parsed any
	if res.Stdout != "" {
		if jsonErr := json.Unmarshal([]byte(res.Stdout), &parsed); jsonErr != nil {
			return nil, nil, &CommandError{
				Message:  "invalid JSON from multipass: " + jsonErr.Error(),
				Argv:     res.Argv,
				ExitCode: res.ExitCode,
				Stdout:   res.Stdout,
				Stderr:   res.Stderr,
			}
		}
	}
	return res, parsed, nil
}

// GetAllInstancesInfo returns all instances with full info, using cache.
func (c *Client) GetAllInstancesInfo(ctx context.Context, useCache bool) ([]map[string]any, error) {
	if useCache {
		c.cacheMu.Lock()
		if c.instancesCache != nil && time.Now().Before(c.instancesCacheExpiry) {
			cached := deepCopyInstances(c.instancesCache)
			c.cacheMu.Unlock()
			return cached, nil
		}
		c.cacheMu.Unlock()
	}

	summary, err := c.listInstancesSummary(ctx)
	if err != nil {
		return nil, err
	}
	if len(summary) == 0 {
		c.cacheMu.Lock()
		c.instancesCache = []map[string]any{}
		c.instancesCacheExpiry = time.Now().Add(c.instancesCacheTTL)
		c.cacheMu.Unlock()
		return []map[string]any{}, nil
	}

	// Fetch detailed info concurrently
	type result struct {
		detail map[string]any
		err    error
	}
	results := make([]result, len(summary))
	var wg sync.WaitGroup
	for i, item := range summary {
		if name, _ := item["name"].(string); name == "" {
			results[i] = result{}
			continue
		}
		wg.Add(1)
		go func(idx int, name string) {
			defer wg.Done()
			detail, detailErr := c.GetInstanceInfo(ctx, name)
			results[idx] = result{detail: detail, err: detailErr}
		}(i, item["name"].(string))
	}
	wg.Wait()

	byName := make(map[string]map[string]any)
	for _, r := range results {
		if r.err == nil && r.detail != nil {
			if name, _ := r.detail["name"].(string); name != "" {
				byName[name] = r.detail
			}
		}
	}

	merged := make([]map[string]any, 0, len(summary))
	for _, item := range summary {
		name, _ := item["name"].(string)
		if detail, ok := byName[name]; ok {
			// Merge summary release info into detail
			summaryRelease, _ := item["release"].(string)
			summaryImageRelease, _ := item["image_release"].(string)
			if summaryRelease != "" {
				detail["image"] = summaryRelease
				detail["release"] = summaryRelease
			} else if summaryImageRelease != "" {
				detail["image"] = summaryImageRelease
			}
			merged = append(merged, detail)
		} else {
			// Use summary info + config fallback
			if name != "" {
				config, _ := c.getInstanceConfigResources(ctx, name, true)
				if cpus, _ := config["cpus"]; cpus > 0 {
					item["cpus"] = cpus
				}
				if memTotal, _ := config["memory_total"]; memTotal > 0 {
					mem, _ := item["memory"].(map[string]any)
					if mem == nil {
						mem = map[string]any{}
					}
					mem["total"] = memTotal
					item["memory"] = mem
				}
				if diskTotal, _ := config["disk_total"]; diskTotal > 0 {
					disk, _ := item["disk"].(map[string]any)
					if disk == nil {
						disk = map[string]any{}
					}
					disk["total"] = diskTotal
					item["disk"] = disk
				}
			}
			merged = append(merged, item)
		}
	}

	c.cacheMu.Lock()
	c.instancesCache = merged
	c.instancesCacheExpiry = time.Now().Add(c.instancesCacheTTL)
	c.cacheMu.Unlock()

	return deepCopyInstances(merged), nil
}

// GetInstanceInfo returns detailed info for a single instance.
func (c *Client) GetInstanceInfo(ctx context.Context, name string) (map[string]any, error) {
	_, raw, err := c.RunJSONChecked(ctx, "info", []string{name}, map[string]any{"--format": "json"})
	if err != nil {
		return nil, err
	}

	data, _ := raw.(map[string]any)
	infoMap, _ := data["info"].(map[string]any)
	info, _ := infoMap[name].(map[string]any)
	if info == nil {
		info = map[string]any{}
	}

	memory, _ := info["memory"].(map[string]any)
	if memory == nil {
		memory = map[string]any{}
	}
	diskTotal, diskUsed := parseDiskUsage(info["disk"], info["disks"])
	config, _ := c.getInstanceConfigResources(ctx, name, true)

	cpus := toInt64(info["cpu_count"])
	memTotal := toBytes(memory["total"])
	memUsed := toBytes(memory["used"])

	if v := config["cpus"]; v > 0 {
		cpus = v
	}
	if v := config["memory_total"]; v > 0 {
		memTotal = v
	}
	if v := config["disk_total"]; v > 0 {
		diskTotal = v
	}

	ipv4 := toStringSlice(info["ipv4"])

	return map[string]any{
		"name":          name,
		"state":         toString(info["state"], "Unknown"),
		"ipv4":          ipv4,
		"image":         toString(info["release"], toString(info["image_release"], "")),
		"image_release": toString(info["image_release"], ""),
		"release":       toString(info["release"], ""),
		"cpus":          cpus,
		"memory": map[string]any{
			"total": memTotal,
			"used":  memUsed,
		},
		"disk": map[string]any{
			"total": diskTotal,
			"used":  diskUsed,
		},
	}, nil
}

func (c *Client) listInstancesSummary(ctx context.Context) ([]map[string]any, error) {
	_, raw, err := c.RunJSONChecked(ctx, "list", nil, map[string]any{"--format": "json"})
	if err != nil {
		return nil, err
	}
	data, _ := raw.(map[string]any)
	list, _ := data["list"].([]any)

	var result []map[string]any
	for _, item := range list {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		diskTotal, diskUsed := parseDiskUsage(m["disk"], m["disks"])
		memory, _ := m["memory"].(map[string]any)
		if memory == nil {
			memory = map[string]any{}
		}
		result = append(result, map[string]any{
			"name":          toString(m["name"], ""),
			"state":         toString(m["state"], "Unknown"),
			"ipv4":          toStringSlice(m["ipv4"]),
			"image":         toString(m["release"], ""),
			"image_release": toString(m["release"], ""),
			"release":       toString(m["release"], ""),
			"cpus":          toInt64(m["cpu_count"]),
			"memory": map[string]any{
				"total": toBytes(memory["total"]),
				"used":  toBytes(memory["used"]),
			},
			"disk": map[string]any{
				"total": diskTotal,
				"used":  diskUsed,
			},
		})
	}
	return result, nil
}

func (c *Client) getInstanceConfigResources(ctx context.Context, name string, useCache bool) (map[string]int64, error) {
	if useCache {
		c.configCacheMu.Lock()
		if entry, ok := c.configCache[name]; ok && time.Now().Before(entry.expiry) {
			result := make(map[string]int64, len(entry.data))
			for k, v := range entry.data {
				result[k] = v
			}
			c.configCacheMu.Unlock()
			return result, nil
		}
		c.configCacheMu.Unlock()
	}

	type keyResult struct {
		key   string
		value string
	}

	keys := map[string]string{
		"cpus":         fmt.Sprintf("local.%s.cpus", name),
		"memory_total": fmt.Sprintf("local.%s.memory", name),
		"disk_total":   fmt.Sprintf("local.%s.disk", name),
	}

	resultsCh := make(chan keyResult, len(keys))
	var wg sync.WaitGroup
	for logicalKey, settingKey := range keys {
		wg.Add(1)
		go func(lk, sk string) {
			defer wg.Done()
			ctx2, cancel := context.WithTimeout(ctx, 10*time.Second)
			defer cancel()
			res, err := c.RunChecked(ctx2, "get", []string{sk}, map[string]any{"--raw": true}, "")
			if err != nil {
				resultsCh <- keyResult{key: lk, value: ""}
				return
			}
			resultsCh <- keyResult{key: lk, value: strings.TrimSpace(res.Stdout)}
		}(logicalKey, settingKey)
	}
	wg.Wait()
	close(resultsCh)

	raw := make(map[string]string)
	for r := range resultsCh {
		raw[r.key] = r.value
	}

	var cpus int64
	if raw["cpus"] != "" {
		if n, err := strconv.ParseInt(raw["cpus"], 10, 64); err == nil {
			cpus = n
		}
	}

	data := map[string]int64{
		"cpus":         cpus,
		"memory_total": parseSize(raw["memory_total"]),
		"disk_total":   parseSize(raw["disk_total"]),
	}

	c.configCacheMu.Lock()
	c.configCache[name] = configCacheEntry{
		expiry: time.Now().Add(c.configCacheTTL),
		data:   data,
	}
	c.configCacheMu.Unlock()

	return data, nil
}

func (c *Client) buildArgv(command string, args []string, options map[string]any) []string {
	argv := []string{c.binary, command}
	for k, v := range options {
		switch val := v.(type) {
		case bool:
			if val {
				argv = append(argv, k)
			}
		case []string:
			for _, s := range val {
				argv = append(argv, k, s)
			}
		default:
			argv = append(argv, k, fmt.Sprintf("%v", v))
		}
	}
	argv = append(argv, args...)
	return argv
}

// --- helpers ---

func toString(v any, def string) string {
	if v == nil {
		return def
	}
	s, ok := v.(string)
	if !ok {
		return def
	}
	if s == "" {
		return def
	}
	return s
}

func toStringSlice(v any) []string {
	if v == nil {
		return []string{}
	}
	arr, ok := v.([]any)
	if !ok {
		return []string{}
	}
	result := make([]string, 0, len(arr))
	for _, item := range arr {
		if s, ok := item.(string); ok {
			result = append(result, s)
		}
	}
	return result
}

func toInt64(v any) int64 {
	if v == nil {
		return 0
	}
	switch n := v.(type) {
	case int64:
		return n
	case float64:
		return int64(n)
	case int:
		return int64(n)
	case string:
		i, _ := strconv.ParseInt(n, 10, 64)
		return i
	}
	return 0
}

func toBytes(v any) int64 {
	if v == nil {
		return 0
	}
	switch n := v.(type) {
	case int64:
		return n
	case float64:
		return int64(n)
	case int:
		return int64(n)
	case string:
		return parseSize(n)
	}
	return 0
}

func parseSize(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	m := sizeRe.FindStringSubmatch(s)
	if m == nil {
		return 0
	}
	amount, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		return 0
	}
	unit := strings.ToLower(m[2])
	mult, ok := sizeMultipliers[unit]
	if !ok {
		return 0
	}
	return int64(amount * float64(mult))
}

func parseDiskUsage(disk, disks any) (total, used int64) {
	if disksMap, ok := disks.(map[string]any); ok && len(disksMap) > 0 {
		for _, dev := range disksMap {
			if devMap, ok := dev.(map[string]any); ok {
				total += toBytes(devMap["total"])
				used += toBytes(devMap["used"])
			}
		}
		if total > 0 || used > 0 {
			return
		}
	}
	if diskMap, ok := disk.(map[string]any); ok {
		total = toBytes(diskMap["total"])
		used = toBytes(diskMap["used"])
	}
	return
}

func deepCopyInstances(src []map[string]any) []map[string]any {
	if src == nil {
		return nil
	}
	dst := make([]map[string]any, len(src))
	for i, m := range src {
		dst[i] = deepCopyMap(m)
	}
	return dst
}

func deepCopyMap(src map[string]any) map[string]any {
	dst := make(map[string]any, len(src))
	for k, v := range src {
		switch val := v.(type) {
		case map[string]any:
			dst[k] = deepCopyMap(val)
		case []string:
			cp := make([]string, len(val))
			copy(cp, val)
			dst[k] = cp
		default:
			dst[k] = v
		}
	}
	return dst
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
