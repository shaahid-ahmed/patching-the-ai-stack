# Every workflow command lives here, so there is one place to look in six
# months. `make help` lists them.

PY ?= python3
WEB := web

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: artifacts
artifacts: ## Rebuild web/public/data/ and the manifest from the Phase III CSVs
	$(PY) -m pipeline.build

.PHONY: verify
verify: ## Check the artifacts agree with the manifest, then typecheck the site
	$(PY) -m pipeline.verify
	cd $(WEB) && npm run check

.PHONY: install
install: ## Install frontend dependencies
	cd $(WEB) && npm ci

.PHONY: dev
dev: ## Run the site locally with hot reload
	cd $(WEB) && npm run dev

.PHONY: build
build: ## Production build into web/dist
	cd $(WEB) && npm run build

.PHONY: preview
preview: build ## Build, then serve the production bundle on :4173
	cd $(WEB) && npm run preview

.PHONY: all
all: artifacts verify build ## Full rebuild from CSVs through to a built site

.PHONY: clean-trash
clean-trash: ## Remove superseded data artifacts the pipeline moved aside
	rm -rf $(WEB)/.trash
