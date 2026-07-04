#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# setup.sh — install dependencies and build Coin Smith (CLI + web UI)
###############################################################################

npm install
npm run -s build   # compiles TypeScript and bundles the web UI

echo "Setup complete. Run ./cli.sh <input.json> or ./web.sh"
