.PHONY: start stop restart logs shell validate clean

# Start local Ghost development server
start:
	docker compose up -d
	@echo ""
	@echo "Ghost is starting..."
	@echo "  - Site:  http://localhost:2368"
	@echo "  - Admin: http://localhost:2368/ghost/"
	@echo ""
	@echo "Your theme is mounted at themes/chris-theme"
	@echo "Changes will be reflected after refreshing the browser"

# Stop local Ghost server
stop:
	docker compose down

# Restart Ghost (useful after theme changes)
restart:
	docker compose restart ghost

# View Ghost logs
logs:
	docker compose logs -f ghost

# Open shell in Ghost container
shell:
	docker compose exec ghost sh

# Validate theme with gscan
validate:
	@command -v gscan >/dev/null 2>&1 || { echo "Installing gscan..."; npm install -g gscan; }
	gscan themes/chris-theme --verbose

# Clean up Docker volumes (WARNING: deletes all local Ghost data)
clean:
	docker compose down -v
	@echo "All local Ghost data has been removed"

# Package theme for manual upload
package:
	cd themes && zip -r chris-theme.zip chris-theme -x "*.DS_Store" -x "*node_modules*"
	@echo "Theme packaged: themes/chris-theme.zip"
