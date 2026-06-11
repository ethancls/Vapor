package container

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var ansiRe = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

const InstallInstructions = "Install Apple Container from https://github.com/apple/container/releases, then run `container system start`. Installation requires macOS admin approval."

type CommandError struct {
	Message  string   `json:"message"`
	Argv     []string `json:"argv"`
	ExitCode int      `json:"exit_code"`
	Stdout   string   `json:"stdout,omitempty"`
	Stderr   string   `json:"stderr,omitempty"`
}

func (e *CommandError) Error() string { return e.Message }

type CommandResult struct {
	Argv       []string `json:"argv"`
	ExitCode   int      `json:"exit_code"`
	Stdout     string   `json:"stdout"`
	Stderr     string   `json:"stderr"`
	DurationMs int64    `json:"duration_ms"`
}

type SystemState struct {
	Installed           bool   `json:"installed"`
	Running             bool   `json:"running"`
	Binary              string `json:"binary"`
	BinaryPath          string `json:"binary_path,omitempty"`
	StatusText          string `json:"status_text,omitempty"`
	VersionText         string `json:"version_text,omitempty"`
	Status              any    `json:"status,omitempty"`
	Version             any    `json:"version,omitempty"`
	Error               string `json:"error,omitempty"`
	InstallInstructions string `json:"install_instructions,omitempty"`
}

type Client struct {
	binary    string
	timeout   time.Duration
	semaphore chan struct{}
	logger    *slog.Logger

	cacheMu              sync.Mutex
	instancesCache       []map[string]any
	instancesCacheExpiry time.Time
	instancesCacheTTL    time.Duration
}

func NewClient(binary string, timeout, cacheTTL time.Duration, concurrency int, logger *slog.Logger) *Client {
	return &Client{
		binary:            binary,
		timeout:           timeout,
		semaphore:         make(chan struct{}, max(1, concurrency)),
		logger:            logger,
		instancesCacheTTL: cacheTTL,
	}
}

func (c *Client) InvalidateCache() {
	c.cacheMu.Lock()
	c.instancesCache = nil
	c.instancesCacheExpiry = time.Time{}
	c.cacheMu.Unlock()
}

func (c *Client) DaemonRunning(ctx context.Context) bool {
	state := c.SystemState(ctx)
	return state.Installed && state.Running
}

func (c *Client) SystemState(ctx context.Context) SystemState {
	state := SystemState{
		Binary:              c.binary,
		InstallInstructions: InstallInstructions,
	}

	if path, err := exec.LookPath(c.binary); err == nil {
		state.Installed = true
		state.BinaryPath = path
	} else {
		state.Error = "Apple Container CLI was not found in PATH"
		return state
	}

	statusRes, statusRaw, statusErr := c.RunJSONChecked(ctx, "system status", nil, map[string]any{"--format": "json"})
	if statusErr == nil {
		state.Running = true
		state.Status = statusRaw
		state.StatusText = statusRes.Stdout
	} else {
		state.Error = statusErr.Error()
	}

	if versionRes, versionRaw, err := c.RunJSONChecked(ctx, "system version", nil, map[string]any{"--format": "json"}); err == nil {
		state.Version = versionRaw
		state.VersionText = versionRes.Stdout
	}

	return state
}

func (c *Client) EnsureSystemRunning(ctx context.Context) SystemState {
	state := c.SystemState(ctx)
	if !state.Installed || state.Running {
		return state
	}
	if _, err := c.RunChecked(ctx, "system start", nil, nil, ""); err != nil {
		state.Error = "failed to start Apple Container system: " + err.Error()
		return state
	}
	return c.SystemState(ctx)
}

func (c *Client) Run(ctx context.Context, command string, args []string, options map[string]any, stdin string) (*CommandResult, error) {
	command = normalizeCommand(command)
	if !SupportedCommands[command] {
		return nil, &CommandError{
			Message:  "unsupported container command: " + command,
			Argv:     []string{c.binary, command},
			ExitCode: -1,
		}
	}

	argv := c.buildArgv(command, args, options)
	select {
	case c.semaphore <- struct{}{}:
	case <-ctx.Done():
		return nil, &CommandError{Message: "context cancelled waiting for command slot", Argv: argv, ExitCode: -1}
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
				Message:  fmt.Sprintf("container command timed out after %s", c.timeout),
				Argv:     argv,
				ExitCode: 124,
			}
		} else {
			return nil, &CommandError{
				Message:  "container binary not found or failed to start: " + runErr.Error(),
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
			msg = fmt.Sprintf("container %s failed (exit %d)", command, res.ExitCode)
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

func (c *Client) RunJSONChecked(ctx context.Context, command string, args []string, options map[string]any) (*CommandResult, any, error) {
	res, err := c.RunChecked(ctx, command, args, options, "")
	if err != nil {
		return nil, nil, err
	}
	parsed, jsonErr := parsePossiblyJSON(res.Stdout)
	if jsonErr != nil {
		return nil, nil, &CommandError{
			Message:  "invalid JSON from container: " + jsonErr.Error(),
			Argv:     res.Argv,
			ExitCode: res.ExitCode,
			Stdout:   res.Stdout,
			Stderr:   res.Stderr,
		}
	}
	return res, parsed, nil
}

func (c *Client) ListContainers(ctx context.Context) ([]map[string]any, error) {
	items, err := c.listJSON(ctx, "list", map[string]any{"--all": true})
	if err == nil {
		return normalizeContainers(items), nil
	}
	items, fallbackErr := c.listJSON(ctx, "list", nil)
	if fallbackErr != nil {
		return nil, err
	}
	return normalizeContainers(items), nil
}

func (c *Client) ListImages(ctx context.Context) ([]map[string]any, error) {
	items, err := c.listJSON(ctx, "image list", nil)
	if err != nil {
		return nil, err
	}
	return normalizeImages(items), nil
}

func (c *Client) ListMachines(ctx context.Context) ([]map[string]any, error) {
	items, err := c.listJSON(ctx, "machine list", nil)
	if err != nil {
		return nil, err
	}
	return normalizeMachines(items), nil
}

func (c *Client) ListNetworks(ctx context.Context) ([]map[string]any, error) {
	items, err := c.listJSON(ctx, "network list", nil)
	if err != nil {
		return nil, err
	}
	return normalizeNetworks(items), nil
}

func (c *Client) ListVolumes(ctx context.Context) ([]map[string]any, error) {
	items, err := c.listJSON(ctx, "volume list", nil)
	if err != nil {
		return nil, err
	}
	return normalizeVolumes(items), nil
}

func (c *Client) ListRegistries(ctx context.Context) ([]map[string]any, error) {
	items, err := c.listJSON(ctx, "registry list", nil)
	if err != nil {
		return nil, err
	}
	return normalizeRegistries(items), nil
}

func (c *Client) BuilderStatus(ctx context.Context) (any, string, error) {
	res, raw, err := c.RunJSONChecked(ctx, "builder status", nil, map[string]any{"--format": "json"})
	if err != nil {
		res, textErr := c.RunChecked(ctx, "builder status", nil, nil, "")
		if textErr != nil {
			return nil, "", textErr
		}
		return nil, res.Stdout, nil
	}
	return raw, res.Stdout, nil
}

func (c *Client) Inspect(ctx context.Context, command, name string) (map[string]any, error) {
	return c.inspectPlainJSON(ctx, command, name)
}

func (c *Client) inspectPlainJSON(ctx context.Context, command, name string) (map[string]any, error) {
	res, err := c.RunChecked(ctx, command, []string{name}, nil, "")
	if err != nil {
		return nil, err
	}
	parsed, jsonErr := parsePossiblyJSON(res.Stdout)
	if jsonErr == nil {
		info := firstJSONMap(parsed)
		info["text"] = res.Stdout
		return info, nil
	}
	return map[string]any{"name": name, "text": res.Stdout, "raw": res.Stdout}, nil
}

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

	items, err := c.ListMachines(ctx)
	if err != nil {
		return nil, err
	}
	c.cacheMu.Lock()
	c.instancesCache = items
	c.instancesCacheExpiry = time.Now().Add(c.instancesCacheTTL)
	c.cacheMu.Unlock()
	return deepCopyInstances(items), nil
}

func (c *Client) GetInstanceInfo(ctx context.Context, name string) (map[string]any, error) {
	info, err := c.Inspect(ctx, "machine inspect", name)
	if err != nil {
		return nil, err
	}
	return normalizeMachine(info), nil
}

func (c *Client) GetContainerInfo(ctx context.Context, name string) (map[string]any, error) {
	info, err := c.Inspect(ctx, "inspect", name)
	if err != nil {
		return nil, err
	}
	return normalizeContainer(info), nil
}

func (c *Client) listJSON(ctx context.Context, command string, extraOptions map[string]any) ([]map[string]any, error) {
	options := map[string]any{"--format": "json"}
	for k, v := range extraOptions {
		options[k] = v
	}
	_, raw, err := c.RunJSONChecked(ctx, command, nil, options)
	if err != nil {
		return nil, err
	}
	return normalizeJSONList(raw), nil
}

func (c *Client) buildArgv(command string, args []string, options map[string]any) []string {
	argv := append([]string{c.binary}, strings.Fields(command)...)
	keys := make([]string, 0, len(options))
	for key := range options {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		value := options[key]
		switch val := value.(type) {
		case nil:
			continue
		case bool:
			if val {
				argv = append(argv, key)
			}
		case []string:
			for _, item := range val {
				argv = append(argv, key, item)
			}
		case []any:
			for _, item := range val {
				argv = append(argv, key, fmt.Sprintf("%v", item))
			}
		default:
			argv = append(argv, key, fmt.Sprintf("%v", value))
		}
	}
	argv = append(argv, args...)
	return argv
}

func normalizeCommand(command string) string {
	return strings.Join(strings.Fields(command), " ")
}

func cleanOutput(s string) string {
	s = ansiRe.ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "\r\n", "\n")
	lines := strings.Split(s, "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		if cr := strings.LastIndexByte(line, '\r'); cr >= 0 {
			line = line[cr+1:]
		}
		line = strings.TrimSpace(line)
		if line != "" {
			result = append(result, line)
		}
	}
	return strings.Join(result, "\n")
}

func parsePossiblyJSON(stdout string) (any, error) {
	text := strings.TrimSpace(stdout)
	if text == "" {
		return nil, nil
	}
	var parsed any
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		return nil, err
	}
	return parsed, nil
}

func firstJSONMap(raw any) map[string]any {
	if m, ok := raw.(map[string]any); ok {
		return m
	}
	if list := normalizeJSONList(raw); len(list) > 0 {
		return list[0]
	}
	return map[string]any{}
}

func normalizeJSONList(raw any) []map[string]any {
	switch value := raw.(type) {
	case []any:
		return mapList(value)
	case map[string]any:
		for _, key := range []string{"items", "list", "containers", "images", "machines", "networks", "volumes", "registries"} {
			if arr, ok := value[key].([]any); ok {
				return mapList(arr)
			}
		}
		if len(value) > 0 {
			return []map[string]any{value}
		}
	}
	return []map[string]any{}
}

func mapList(items []any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		if m, ok := item.(map[string]any); ok {
			result = append(result, m)
		}
	}
	return result
}

func normalizeContainers(items []map[string]any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, normalizeContainer(item))
	}
	return result
}

func normalizeMachines(items []map[string]any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, normalizeMachine(item))
	}
	return result
}

func normalizeImages(items []map[string]any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, normalizeImage(item))
	}
	return result
}

func normalizeNetworks(items []map[string]any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, normalizeNetwork(item))
	}
	return result
}

func normalizeVolumes(items []map[string]any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, normalizeVolume(item))
	}
	return result
}

func normalizeRegistries(items []map[string]any) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		result = append(result, normalizeRegistry(item))
	}
	return result
}

func normalizeRegistry(item map[string]any) map[string]any {
	name := firstString(item, "name", "id")
	url := firstString(item, "url", "endpoint", "serveraddress")

	return map[string]any{
		"id":   name,
		"name": name,
		"url":  url,
		"raw":  item,
	}
}

func normalizeVolume(item map[string]any) map[string]any {
	name := firstString(item, "name", "id")
	driver := firstString(item, "driver", "type")
	size := toInt64(item["size"])

	return map[string]any{
		"id":      name,
		"name":    name,
		"driver":  driver,
		"size":    formatSize(size),
		"rawSize": size,
		"raw":     item,
	}
}

func normalizeNetwork(item map[string]any) map[string]any {
	config := mapValue(item, "configuration")
	statusInfo := mapValue(item, "status")
	name := firstString(config, "name")
	if name == "" {
		name = firstString(item, "name", "id")
	}
	status := firstString(item, "status", "state")
	if status == "" {
		if firstString(statusInfo, "ipv4Subnet", "ipv6Subnet", "ipv4Gateway", "ipv6Gateway") != "" {
			status = "up"
		} else {
			status = "configured"
		}
	}
	netType := firstString(config, "mode")
	if netType == "" {
		netType = firstString(item, "type", "driver")
	}
	plugin := firstString(config, "plugin")

	address := firstString(statusInfo, "ipv4Subnet", "ipv4Gateway", "ipv6Subnet", "ipv6Gateway")
	if address == "" {
		addr := item["address"]
		switch v := addr.(type) {
		case string:
			address = v
		case map[string]any:
			if subnet := firstString(v, "ipv4Subnet", "subnet"); subnet != "" {
				address = subnet
			} else if gateway := firstString(v, "ipv4Gateway", "gateway"); gateway != "" {
				address = gateway
			} else if b, err := json.Marshal(v); err == nil {
				address = string(b)
			}
		}
	}

	return map[string]any{
		"id":           firstNonEmpty(firstString(item, "id"), name),
		"name":         name,
		"status":       strings.ToLower(status),
		"type":         netType,
		"mode":         netType,
		"plugin":       plugin,
		"address":      address,
		"ipv4_subnet":  firstString(statusInfo, "ipv4Subnet"),
		"ipv4_gateway": firstString(statusInfo, "ipv4Gateway"),
		"ipv6_subnet":  firstString(statusInfo, "ipv6Subnet"),
		"ipv6_gateway": firstString(statusInfo, "ipv6Gateway"),
		"labels":       mapValue(config, "labels"),
		"instances":    item["instances"],
		"created":      firstString(config, "creationDate"),
		"raw":          item,
	}
}

func normalizeImage(item map[string]any) map[string]any {
	id := firstString(item, "id", "digest")
	var name, tag string
	var size int64

	config, ok := item["configuration"].(map[string]any)
	if ok {
		fullName := firstString(config, "name")
		if fullName == "" {
			if descriptor, ok := config["descriptor"].(map[string]any); ok {
				fullName = firstString(descriptor, "name")
			}
		}

		if fullName != "" {
			if idx := strings.LastIndex(fullName, ":"); idx >= 0 {
				name = fullName[:idx]
				tag = fullName[idx+1:]
			} else {
				name = fullName
				tag = "latest"
			}
		}
	}

	platforms := []string{}
	labels := map[string]any{}
	if variants, ok := item["variants"].([]any); ok {
		for _, v := range variants {
			if vm, ok := v.(map[string]any); ok {
				vSize := toInt64(vm["size"])
				if vSize > size {
					size = vSize
				}
				if platform := platformString(mapValue(vm, "platform")); platform != "" {
					platforms = appendUnique(platforms, platform)
				}
				if name == "" {
					if vConfig, ok := vm["config"].(map[string]any); ok {
						if innerConfig, ok := vConfig["config"].(map[string]any); ok {
							if variantLabels := labelsValue(innerConfig); len(variantLabels) > 0 {
								labels = variantLabels
								if title := firstString(variantLabels, "org.opencontainers.image.title"); title != "" {
									name = title
								}
								if version := firstString(variantLabels, "org.opencontainers.image.version"); version != "" {
									tag = version
								}
							}
						}
					}
				}
			}
		}
	}

	if name == "" {
		name = firstString(item, "name", "image", "repo_name", "reference")
	}
	if name == "" {
		name = id
	}
	if tag == "" {
		tag = "-"
	}

	return map[string]any{
		"id":         id,
		"name":       name,
		"tag":        tag,
		"size":       formatSize(size),
		"rawSize":    size,
		"created":    firstString(config, "creationDate"),
		"digest":     firstString(mapValue(config, "descriptor"), "digest"),
		"media_type": firstString(mapValue(config, "descriptor"), "mediaType"),
		"platforms":  platforms,
		"labels":     labels,
		"source_url": firstString(labels, "org.opencontainers.image.source", "org.opencontainers.image.url"),
		"raw":        item,
	}
}

func formatSize(bytes int64) string {
	if bytes == 0 {
		return "-"
	}
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func normalizeContainer(item map[string]any) map[string]any {
	config := mapValue(item, "configuration")
	status := mapValue(item, "status")
	resources := mapValue(config, "resources")
	imageInfo := mapValue(config, "image")
	name := firstString(config, "id")
	if name == "" {
		name = firstString(item, "name", "names", "container", "id")
	}
	state := firstString(status, "state")
	if state == "" {
		state = firstString(item, "state", "status")
	}
	image := firstString(imageInfo, "reference", "name")
	if image == "" {
		image = firstString(item, "image", "imageRef", "image_reference")
	}
	id := firstString(item, "id", "containerID", "container_id")
	if id == "" {
		id = firstString(item, "containerId", "containerID")
	}
	if state == "" {
		state = "Unknown"
	}
	if name == "" {
		name = id
	}
	memoryTotal := toInt64(resources["memoryInBytes"])
	if memoryTotal == 0 {
		memoryTotal = toInt64(resources["memory"])
	}
	if memoryTotal == 0 {
		memoryTotal = toInt64(item["memoryLimit"])
	}
	diskTotal := toInt64(item["diskSize"])
	if diskTotal == 0 {
		diskTotal = toInt64(item["disk"])
	}
	ipv4 := []string{}
	if ip := firstString(item, "ipAddress", "ip", "address"); ip != "" {
		ipv4 = append(ipv4, ip)
	}
	for _, network := range listValue(status, "networks") {
		if ip := firstString(network, "address", "ipAddress", "ipv4Address"); ip != "" {
			ipv4 = appendUnique(ipv4, ip)
		}
	}
	cpus := toInt64(resources["cpus"])
	if cpus == 0 {
		cpus = toInt64(item["cpus"])
	}
	return map[string]any{
		"id":          id,
		"name":        name,
		"state":       titleState(state),
		"status":      state,
		"image":       image,
		"raw":         item,
		"ipv4":        ipv4,
		"cpus":        cpus,
		"memory":      map[string]any{"total": memoryTotal, "used": int64(0)},
		"disk":        map[string]any{"total": diskTotal, "used": int64(0)},
		"created":     firstNonEmpty(firstString(config, "creationDate"), firstString(item, "created", "createdAt", "created_at", "createdDate")),
		"started":     firstString(status, "startedDate"),
		"networks":    config["networks"],
		"ports":       config["publishedPorts"],
		"mounts":      config["mounts"],
		"platform":    config["platform"],
		"read_only":   config["readOnly"],
		"rosetta":     config["rosetta"],
		"ssh":         config["ssh"],
		"use_init":    config["useInit"],
		"runtime":     firstString(config, "runtimeHandler"),
		"command":     firstString(mapValue(config, "initProcess"), "executable"),
		"arguments":   mapValue(config, "initProcess")["arguments"],
		"environment": mapValue(config, "initProcess")["environment"],
	}
}

func normalizeMachine(item map[string]any) map[string]any {
	name := firstString(item, "name", "machine", "id")
	state := firstString(item, "state", "status")
	if state == "" {
		state = "Unknown"
	}
	cpus := toInt64(item["cpus"])
	if cpus == 0 {
		cpus = toInt64(item["cpuCount"])
	}
	image := firstString(item, "image", "os", "kernel")
	if image == "" {
		if imageInfo, ok := item["image"].(map[string]any); ok {
			image = firstString(imageInfo, "reference", "name")
		}
	}
	memoryTotal := toInt64(item["memory"])
	if memoryTotal == 0 {
		memoryTotal = toInt64(item["memorySize"])
	}
	diskTotal := toInt64(item["diskSize"])
	if diskTotal == 0 {
		diskTotal = toInt64(item["disk"])
	}
	ipv4 := []string{}
	if ip := firstString(item, "ipAddress", "ip", "address"); ip != "" {
		ipv4 = append(ipv4, ip)
	}
	return map[string]any{
		"id":       firstString(item, "id"),
		"name":     name,
		"state":    titleState(state),
		"status":   state,
		"image":    image,
		"raw":      item,
		"ipv4":     ipv4,
		"cpus":     cpus,
		"memory":   map[string]any{"total": memoryTotal, "used": int64(0)},
		"disk":     map[string]any{"total": diskTotal, "used": int64(0)},
		"created":  firstString(item, "created", "createdAt", "created_at", "createdDate"),
		"started":  firstString(item, "started", "startedAt", "started_at", "startedDate"),
		"platform": item["platform"],
	}
}

func mapValue(m map[string]any, key string) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	if value, ok := m[key].(map[string]any); ok {
		return value
	}
	return map[string]any{}
}

func labelsValue(m map[string]any) map[string]any {
	for _, key := range []string{"labels", "Labels"} {
		if labels, ok := m[key].(map[string]any); ok {
			return labels
		}
	}
	return map[string]any{}
}

func listValue(m map[string]any, key string) []map[string]any {
	if m == nil {
		return nil
	}
	if items, ok := m[key].([]any); ok {
		return mapList(items)
	}
	return nil
}

func platformString(platform map[string]any) string {
	os := firstString(platform, "os")
	arch := firstString(platform, "architecture", "arch")
	variant := firstString(platform, "variant")
	if os == "" && arch == "" {
		return ""
	}
	value := strings.Trim(os+"/"+arch, "/")
	if variant != "" {
		value += "/" + variant
	}
	return value
}

func appendUnique(values []string, next string) []string {
	if next == "" {
		return values
	}
	for _, value := range values {
		if value == next {
			return values
		}
	}
	return append(values, next)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func firstString(m map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			switch typed := value.(type) {
			case string:
				if typed != "" {
					return typed
				}
			case []any:
				if len(typed) > 0 {
					if s, ok := typed[0].(string); ok && s != "" {
						return s
					}
				}
			case []string:
				if len(typed) > 0 && typed[0] != "" {
					return typed[0]
				}
			case float64:
				return strconv.FormatInt(int64(typed), 10)
			}
		}
	}
	return ""
}

func titleState(state string) string {
	state = strings.TrimSpace(state)
	if state == "" {
		return "Unknown"
	}
	lower := strings.ToLower(state)
	switch {
	case strings.Contains(lower, "running"):
		return "Running"
	case strings.Contains(lower, "stopped"), strings.Contains(lower, "exited"):
		return "Stopped"
	case strings.Contains(lower, "created"):
		return "Created"
	default:
		return strings.ToUpper(state[:1]) + state[1:]
	}
}

func toInt64(v any) int64 {
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
	default:
		return 0
	}
}

func deepCopyInstances(src []map[string]any) []map[string]any {
	if src == nil {
		return nil
	}
	dst := make([]map[string]any, len(src))
	for i, item := range src {
		dst[i] = deepCopyMap(item)
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
