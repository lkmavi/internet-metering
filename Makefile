.PHONY: install dev build test cli tui up down
install:
	npm ci
dev:
	npm run dev
build:
	npm run build
test:
	npm test
cli:
	npm run measure -- $(URL)
tui:
	npm run tui -- $(URL)
up:
	docker compose up --build -d
down:
	docker compose down
