# Every workflow command lives here, so there is one place to look in six
# months. `make help` lists them.

# Everything runs inside a project virtualenv. Homebrew's Python refuses
# system-wide installs (PEP 668), and a bare `python3` can resolve to a
# different interpreter than the one `pip` just installed into, so pinning it
# here removes both problems.
VENV := .venv
VENV_PY := $(VENV)/bin/python

# Use the venv when it exists, otherwise fall back so `make doctor` still runs.
PY := $(shell [ -x $(VENV)/bin/python ] && echo $(VENV)/bin/python || echo python3)

# Interpreter used to CREATE the venv. pandas and scipy publish wheels a little
# behind the newest Python, so prefer a version that reliably has them and let
# BASE_PY override if you want a specific one.
BASE_PY ?= $(shell for v in python3.12 python3.13 python3.11 python3.10 python3; do \
	command -v $$v >/dev/null 2>&1 && echo $$v && break; done)

WEB := web

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: ## Create .venv and install the Python dependencies
	@echo "creating $(VENV) with $(BASE_PY) ($$($(BASE_PY) -V 2>&1))"
	@$(BASE_PY) -m venv $(VENV) 2>/dev/null || $(BASE_PY) -m venv --without-pip $(VENV)
	@$(VENV_PY) -m ensurepip --upgrade >/dev/null 2>&1 || true
	@$(VENV_PY) -m pip install --quiet --upgrade pip 2>/dev/null || \
		echo "  (could not upgrade pip; continuing, it is not required)"
	$(VENV_PY) -m pip install -r requirements.txt
	@echo
	@echo "done. every make target now uses $(VENV_PY)"
	@$(MAKE) --no-print-directory doctor

.PHONY: doctor
doctor: ## Check this machine has what the pipeline needs
	@[ -x $(VENV_PY) ] && echo "venv     $(VENV)" || echo "venv     MISSING  -> make setup"
	@$(PY) -c "import sys; print('python  ', sys.version.split()[0], sys.executable)"
	@$(PY) -c "import pandas; print('pandas  ', pandas.__version__)" 2>/dev/null || echo "pandas   MISSING  -> make setup"
	@$(PY) -c "import scipy; print('scipy   ', scipy.__version__)" 2>/dev/null || echo "scipy    MISSING  -> make setup"
	@$(PY) -c "import openai; print('openai  ', openai.__version__)" 2>/dev/null || echo "openai   missing (only needed for --provider meta)"
	@$(PY) -c "from pipeline import env; env.load_once(); print('keys    ', env.describe('MODEL_API_KEY','ANTHROPIC_API_KEY'))"

.PHONY: enrich
enrich: ## Label advisories with a model (default: Meta Model API / Muse). Costs money.
	$(PY) -m pipeline.enrich --provider $(PROVIDER) $(ARGS)

PROVIDER ?= meta

.PHONY: enrich-estimate
enrich-estimate: ## What a full enrichment run would call and roughly cost
	$(PY) -m pipeline.enrich --provider $(PROVIDER) --dry-run

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
