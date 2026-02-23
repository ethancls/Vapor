SHELL := /usr/bin/env bash
PATH_EXT := /tmp/go/bin:/home/ethancls/go/bin:/home/ethancls/.nvm/versions/node/v20.19.0/bin
SERVICE_USER ?= $(shell id -un)

.PHONY: dev build run install uninstall service-status logs

## Hot reload: Go backend (air) + frontend Vite HMR en parallèle
dev:
	@mkdir -p tmp
	@export PATH="$(PATH_EXT):$$PATH"; \
	export VAPOR_BIND=0.0.0.0:8100; \
	trap 'kill 0' SIGINT SIGTERM; \
	if command -v air >/dev/null 2>&1; then \
		air & \
	else \
		echo "air not found, starting backend without hot reload"; \
		go run . & \
	fi; \
	npm run dev --prefix frontend & \
	wait

## Build production (frontend embarqué dans le binaire Go)
build:
	@export PATH="$(PATH_EXT):$$PATH"; \
	npm run build --prefix frontend && \
	CGO_ENABLED=0 go build -ldflags="-s -w" -o vapor . && \
	echo "→ ./vapor ($$(du -sh vapor | cut -f1))"

## Lance le binaire de prod
run: build
	./vapor

install:
	./deploy/install.sh

uninstall:
	sudo ./deploy/uninstall.sh

service-status:
	systemctl --no-pager status "vapor@$(SERVICE_USER)"

logs:
	journalctl -u "vapor@$(SERVICE_USER)" -f
