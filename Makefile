SHELL := /usr/bin/env bash
PATH_EXT := /tmp/go/bin:/home/ethancls/go/bin:/home/ethancls/.nvm/versions/node/v20.19.0/bin
VAPOR_UI_PASSWORD ?= dev

.PHONY: dev build run install uninstall service-status logs

## Hot reload: Go backend (air) + frontend Vite HMR en parallèle
dev:
	@mkdir -p tmp
	@export PATH="$(PATH_EXT):$$PATH"; \
	export VAPOR_UI_PASSWORD="$(VAPOR_UI_PASSWORD)"; \
	export VAPOR_BIND=0.0.0.0:8100; \
	trap 'kill 0' SIGINT SIGTERM; \
	air & \
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
	VAPOR_UI_PASSWORD=$(VAPOR_UI_PASSWORD) ./vapor

install:
	sudo ./deploy/install.sh

uninstall:
	sudo ./deploy/uninstall.sh

service-status:
	systemctl --no-pager status vapor.service

logs:
	journalctl -u vapor.service -f
