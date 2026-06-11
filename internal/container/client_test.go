package container

import (
	"encoding/json"
	"testing"
)

func decodeMap(t *testing.T, text string) map[string]any {
	t.Helper()
	var item map[string]any
	if err := json.Unmarshal([]byte(text), &item); err != nil {
		t.Fatal(err)
	}
	return item
}

func TestNormalizeContainerAppleInspectShape(t *testing.T) {
	item := decodeMap(t, `{
		"configuration": {
			"creationDate": "2026-06-11T17:21:10Z",
			"id": "test",
			"image": {"reference": "docker.io/library/alpine:latest"},
			"mounts": [],
			"networks": [{"network": "default"}],
			"platform": {"architecture": "arm64", "os": "linux"},
			"publishedPorts": [],
			"resources": {"cpus": 4, "memoryInBytes": 1073741824}
		},
		"id": "test",
		"status": {"startedDate": "2026-06-11T17:23:43Z", "state": "stopped"}
	}`)

	got := normalizeContainer(item)
	if got["name"] != "test" {
		t.Fatalf("name = %v", got["name"])
	}
	if got["state"] != "Stopped" {
		t.Fatalf("state = %v", got["state"])
	}
	if got["image"] != "docker.io/library/alpine:latest" {
		t.Fatalf("image = %v", got["image"])
	}
	if got["cpus"] != int64(4) {
		t.Fatalf("cpus = %v", got["cpus"])
	}
	memory := got["memory"].(map[string]any)
	if memory["total"] != int64(1073741824) {
		t.Fatalf("memory total = %v", memory["total"])
	}
}

func TestNormalizeMachineAppleInspectShape(t *testing.T) {
	item := decodeMap(t, `{
		"containerId": "alpina-8e9ecd",
		"cpus": 5,
		"createdDate": "2026-06-10T18:00:29Z",
		"diskSize": 78856192,
		"id": "alpina",
		"image": {"reference": "docker.io/library/alpine:latest"},
		"ipAddress": "192.168.64.10",
		"memory": 8589934592,
		"platform": {"architecture": "arm64", "os": "linux"},
		"startedDate": "2026-06-11T17:17:27Z",
		"status": "running"
	}`)

	got := normalizeMachine(item)
	if got["name"] != "alpina" {
		t.Fatalf("name = %v", got["name"])
	}
	if got["state"] != "Running" {
		t.Fatalf("state = %v", got["state"])
	}
	if got["image"] != "docker.io/library/alpine:latest" {
		t.Fatalf("image = %v", got["image"])
	}
	if got["started"] != "2026-06-11T17:17:27Z" {
		t.Fatalf("started = %v", got["started"])
	}
}

func TestNormalizeNetworkAppleShape(t *testing.T) {
	item := decodeMap(t, `{
		"configuration": {
			"creationDate": "2026-06-10T13:16:06Z",
			"labels": {"com.apple.container.resource.role": "builtin"},
			"mode": "nat",
			"name": "default",
			"plugin": "container-network-vmnet"
		},
		"id": "default",
		"status": {"ipv4Gateway": "192.168.64.1", "ipv4Subnet": "192.168.64.0/24", "ipv6Subnet": "fdd8::/64"}
	}`)

	got := normalizeNetwork(item)
	if got["name"] != "default" {
		t.Fatalf("name = %v", got["name"])
	}
	if got["type"] != "nat" {
		t.Fatalf("type = %v", got["type"])
	}
	if got["plugin"] != "container-network-vmnet" {
		t.Fatalf("plugin = %v", got["plugin"])
	}
	if got["status"] != "up" {
		t.Fatalf("status = %v", got["status"])
	}
	if got["ipv4_subnet"] != "192.168.64.0/24" {
		t.Fatalf("ipv4_subnet = %v", got["ipv4_subnet"])
	}
}

func TestNormalizeImageAppleShape(t *testing.T) {
	item := decodeMap(t, `{
		"configuration": {
			"creationDate": "2026-06-09T20:11:09Z",
			"descriptor": {"digest": "sha256:a2d49", "mediaType": "application/vnd.oci.image.index.v1+json"},
			"name": "docker.io/library/alpine:latest"
		},
		"id": "a2d49",
		"variants": [{
			"config": {"config": {"Labels": {"org.opencontainers.image.source": "https://example.test/repo"}}},
			"platform": {"architecture": "arm64", "os": "linux", "variant": "v8"},
			"size": 4203982
		}]
	}`)

	got := normalizeImage(item)
	if got["name"] != "docker.io/library/alpine" {
		t.Fatalf("name = %v", got["name"])
	}
	if got["tag"] != "latest" {
		t.Fatalf("tag = %v", got["tag"])
	}
	if got["digest"] != "sha256:a2d49" {
		t.Fatalf("digest = %v", got["digest"])
	}
	platforms := got["platforms"].([]string)
	if len(platforms) != 1 || platforms[0] != "linux/arm64/v8" {
		t.Fatalf("platforms = %v", platforms)
	}
}
