package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/user/eve/internal/container"
)

func (srv *Server) handleContainerSystem(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		if r.URL.Query().Get("ensure") == "true" {
			writeJSON(w, http.StatusOK, map[string]any{"system": srv.mp.EnsureSystemRunning(r.Context())})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"system": srv.mp.SystemState(r.Context())})
	case http.MethodPost:
		writeJSON(w, http.StatusOK, map[string]any{"system": srv.mp.EnsureSystemRunning(r.Context())})
	default:
		methodNotAllowed(w)
	}
}

func (srv *Server) handleContainerCommands(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cmds := container.SortedCommands()
		items := make([]map[string]any, 0, len(cmds))
		for _, cmd := range cmds {
			items = append(items, map[string]any{
				"name":     cmd,
				"mutating": container.MutatingCommands[cmd],
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"commands": items})
	case http.MethodPost:
		var body struct {
			Command         string         `json:"command"`
			Args            []string       `json:"args"`
			Options         map[string]any `json:"options"`
			Stdin           string         `json:"stdin"`
			ConfirmMutation bool           `json:"confirm_mutation"`
		}
		if !decodeBody(w, r, &body) {
			return
		}
		body.Command = strings.Join(strings.Fields(body.Command), " ")
		if !container.SupportedCommands[body.Command] {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "unsupported command"})
			return
		}
		if container.MutatingCommands[body.Command] && !body.ConfirmMutation {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "mutating command requires confirmation"})
			return
		}
		res, err := srv.mp.Run(r.Context(), body.Command, body.Args, body.Options, body.Stdin)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		if container.MutatingCommands[body.Command] {
			srv.mp.InvalidateCache()
		}
		writeJSON(w, http.StatusOK, map[string]any{"result": res})
	default:
		methodNotAllowed(w)
	}
}

func (srv *Server) routeContainerCommandHelp(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/container/commands/")
	if !strings.HasSuffix(path, "/help") {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	command := strings.TrimSuffix(path, "/help")
	command = strings.ReplaceAll(command, "/", " ")
	help, err := srv.mp.CommandHelp(r.Context(), command)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"command": command, "help": help})
}

func (srv *Server) handleContainersDispatch(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := srv.mp.ListContainers(r.Context())
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"containers": items})
	case http.MethodPost:
		var body struct {
			Mode    string         `json:"mode"`
			Image   string         `json:"image"`
			Name    string         `json:"name"`
			Args    []string       `json:"args"`
			Options map[string]any `json:"options"`
		}
		if !decodeBody(w, r, &body) {
			return
		}
		if body.Image == "" {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "image is required"})
			return
		}
		command := "run"
		if body.Mode == "create" {
			command = "create"
		}
		options := cloneOptions(body.Options)
		if body.Name != "" {
			options["--name"] = body.Name
		}
		args := append([]string{body.Image}, body.Args...)
		res, err := srv.mp.RunChecked(r.Context(), command, args, options, "")
		if err != nil {
			srv.logAction(command, body.Name, "error", err.Error())
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		srv.mp.InvalidateCache()
		srv.logAction(command, body.Name, "success", "")
		writeJSON(w, http.StatusOK, map[string]any{"status": "success", "result": res})
	default:
		methodNotAllowed(w)
	}
}

func (srv *Server) routeContainers(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/containers/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	name := parts[0]
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			info, err := srv.mp.Inspect(r.Context(), "inspect", name)
			if err != nil {
				writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"container": info})
		case http.MethodDelete:
			res, err := srv.mp.RunChecked(r.Context(), "delete", []string{name}, nil, "")
			if err != nil {
				writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
				return
			}
			srv.mp.InvalidateCache()
			writeJSON(w, http.StatusOK, map[string]any{"status": "success", "result": res})
		default:
			methodNotAllowed(w)
		}
		return
	}

	switch parts[1] {
	case "actions":
		if len(parts) != 3 || r.Method != http.MethodPost {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		action := parts[2]
		if action != "start" && action != "stop" && action != "kill" && action != "delete" {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "unsupported action"})
			return
		}
		res, err := srv.mp.RunChecked(r.Context(), action, []string{name}, nil, "")
		if err != nil {
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		srv.mp.InvalidateCache()
		writeJSON(w, http.StatusOK, map[string]any{"status": "success", "result": res})
	case "logs":
		res, err := srv.mp.RunChecked(r.Context(), "logs", []string{name}, nil, "")
		if err != nil {
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"logs": res.Stdout, "stderr": res.Stderr})
	case "stats":
		res, raw, err := srv.mp.RunJSONChecked(r.Context(), "stats", []string{name}, map[string]any{"--format": "json"})
		if err != nil {
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"stats": raw, "raw": res.Stdout})
	case "exec":
		srv.handleExecInstance(w, r, name)
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
	}
}

func (srv *Server) handleLocalImages(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		items, err := srv.mp.ListImages(r.Context())
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"images": items})
	case http.MethodPost:
		var body struct {
			Action  string         `json:"action"`
			Image   string         `json:"image"`
			Target  string         `json:"target"`
			Args    []string       `json:"args"`
			Options map[string]any `json:"options"`
		}
		if !decodeBody(w, r, &body) {
			return
		}
		if body.Image == "" {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "image is required"})
			return
		}
		command := "image pull"
		args := []string{body.Image}
		switch body.Action {
		case "", "pull":
		case "delete":
			command = "image delete"
		case "inspect":
			command = "image inspect"
		case "tag":
			command = "image tag"
			if body.Target == "" {
				writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "target is required"})
				return
			}
			args = []string{body.Image, body.Target}
		default:
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "unsupported image action"})
			return
		}
		res, err := srv.mp.RunChecked(r.Context(), command, append(args, body.Args...), body.Options, "")
		if err != nil {
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "success", "result": res})
	default:
		methodNotAllowed(w)
	}
}

func (srv *Server) handleMachines(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := srv.mp.ListMachines(r.Context())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"machines": items})
}

func (srv *Server) routeMachines(w http.ResponseWriter, r *http.Request) {
	name := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/machines/"), "/")
	if name == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	parts := strings.Split(name, "/")
	machine := parts[0]
	if len(parts) == 1 && r.Method == http.MethodGet {
		info, err := srv.mp.Inspect(r.Context(), "machine inspect", machine)
		if err != nil {
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"machine": info})
		return
	}
	if len(parts) == 2 && parts[1] == "logs" && r.Method == http.MethodGet {
		res, err := srv.mp.RunChecked(r.Context(), "machine logs", []string{machine}, nil, "")
		if err != nil {
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"logs": res.Stdout})
		return
	}
	if len(parts) == 2 && parts[1] == "actions" && r.Method == http.MethodPost {
		var body struct {
			Action string `json:"action"`
		}
		if !decodeBody(w, r, &body) {
			return
		}
		command := "machine " + body.Action
		if !container.SupportedCommands[command] || !container.MutatingCommands[command] {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "unsupported machine action"})
			return
		}
		res, err := srv.mp.RunChecked(r.Context(), command, []string{machine}, nil, "")
		if err != nil {
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "success", "result": res})
		return
	}
	writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
}

func (srv *Server) handleVolumes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := srv.mp.ListVolumes(r.Context())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"volumes": items})
}

func (srv *Server) handleRegistries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	items, err := srv.mp.ListRegistries(r.Context())
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"registries": items})
}

func (srv *Server) handleBuilder(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		status, text, err := srv.mp.BuilderStatus(r.Context())
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"builder": status, "text": text})
	case http.MethodPost:
		var body struct {
			Action string `json:"action"`
		}
		if !decodeBody(w, r, &body) {
			return
		}
		command := "builder " + body.Action
		if !container.SupportedCommands[command] || !container.MutatingCommands[command] {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "unsupported builder action"})
			return
		}
		res, err := srv.mp.RunChecked(r.Context(), command, nil, nil, "")
		if err != nil {
			writeJSON(w, httpStatusFromError(err.Error()), map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"status": "success", "result": res})
	default:
		methodNotAllowed(w)
	}
}

func (srv *Server) handleRegistrySearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	provider := r.URL.Query().Get("provider")
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, http.StatusOK, map[string]any{"results": []any{}})
		return
	}
	if provider == "ghcr" || strings.HasPrefix(q, "ghcr.io/") {
		results, err := searchGHCR(q)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"provider": "ghcr", "results": results})
		return
	}
	results, err := searchDockerHub(q)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"provider": "dockerhub", "results": results})
}

func (srv *Server) handleRegistryTags(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	provider := r.URL.Query().Get("provider")
	image := strings.TrimSpace(r.URL.Query().Get("image"))
	if image == "" {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "image is required"})
		return
	}
	var (
		tags []map[string]any
		err  error
	)
	if provider == "ghcr" || strings.HasPrefix(image, "ghcr.io/") {
		tags, err = ghcrTags(image)
	} else {
		tags, err = dockerHubTags(image)
	}
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"tags": tags})
}

func cloneOptions(input map[string]any) map[string]any {
	output := map[string]any{}
	for key, value := range input {
		output[key] = value
	}
	return output
}

func searchDockerHub(q string) ([]map[string]any, error) {
	endpoint := "https://hub.docker.com/v2/search/repositories/?page_size=25&query=" + url.QueryEscape(q)
	var payload struct {
		Results []map[string]any `json:"results"`
	}
	if err := getJSON(endpoint, &payload); err != nil {
		return nil, err
	}
	results := make([]map[string]any, 0, len(payload.Results))
	for _, item := range payload.Results {
		name := fmt.Sprintf("%v", item["repo_name"])
		if name == "" || name == "<nil>" {
			continue
		}
		item["image"] = dockerHubPullRef(name)
		item["provider"] = "dockerhub"
		results = append(results, item)
	}
	return results, nil
}

func dockerHubTags(image string) ([]map[string]any, error) {
	endpoint := "https://hub.docker.com/v2/repositories/" + dockerHubRepositoryPath(image) + "/tags?page_size=50"
	var payload struct {
		Results []map[string]any `json:"results"`
	}
	if err := getJSON(endpoint, &payload); err != nil {
		return nil, err
	}
	return payload.Results, nil
}

func dockerHubRepositoryPath(image string) string {
	image = strings.TrimPrefix(image, "docker.io/")
	image = strings.TrimPrefix(image, "index.docker.io/")
	parts := strings.Split(image, "/")
	if len(parts) == 1 {
		return "library/" + url.PathEscape(parts[0])
	}
	return url.PathEscape(parts[0]) + "/" + url.PathEscape(parts[1])
}

func dockerHubPullRef(repo string) string {
	if !strings.Contains(repo, "/") {
		return repo
	}
	return repo
}

func searchGHCR(q string) ([]map[string]any, error) {
	owner, image := parseGHCRImage(q)
	if owner == "" || image == "" {
		return []map[string]any{}, nil
	}
	tags, err := ghcrTags("ghcr.io/" + owner + "/" + image)
	if err != nil {
		return nil, err
	}
	return []map[string]any{{
		"provider": "ghcr",
		"name":     owner + "/" + image,
		"image":    "ghcr.io/" + owner + "/" + image,
		"tags":     tags,
	}}, nil
}

func ghcrTags(imageRef string) ([]map[string]any, error) {
	owner, image := parseGHCRImage(imageRef)
	if owner == "" || image == "" {
		return nil, fmt.Errorf("GHCR lookup requires ghcr.io/<owner>/<image>")
	}
	pathImage := url.PathEscape(image)
	endpoints := []string{
		"https://api.github.com/users/" + url.PathEscape(owner) + "/packages/container/" + pathImage + "/versions?per_page=50",
		"https://api.github.com/orgs/" + url.PathEscape(owner) + "/packages/container/" + pathImage + "/versions?per_page=50",
	}
	var lastErr error
	for _, endpoint := range endpoints {
		var versions []map[string]any
		err := getJSON(endpoint, &versions)
		if err == nil {
			tags := make([]map[string]any, 0, len(versions))
			for _, version := range versions {
				metadata, _ := version["metadata"].(map[string]any)
				containerMeta, _ := metadata["container"].(map[string]any)
				tagValues, _ := containerMeta["tags"].([]any)
				for _, tag := range tagValues {
					tags = append(tags, map[string]any{
						"name":       fmt.Sprintf("%v", tag),
						"updated_at": version["updated_at"],
					})
				}
			}
			return tags, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func parseGHCRImage(input string) (string, string) {
	input = strings.TrimPrefix(input, "https://")
	input = strings.TrimPrefix(input, "ghcr.io/")
	input = strings.Trim(input, "/")
	parts := strings.Split(input, "/")
	if len(parts) < 2 {
		return "", ""
	}
	image := strings.Join(parts[1:], "/")
	if tagIdx := strings.LastIndex(image, ":"); tagIdx >= 0 {
		image = image[:tagIdx]
	}
	return parts[0], image
}

func getJSON(endpoint string, target any) error {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Eve Apple Container Dashboard")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return fmt.Errorf("%s: %s", res.Status, strings.TrimSpace(string(body)))
	}
	return json.NewDecoder(res.Body).Decode(target)
}
