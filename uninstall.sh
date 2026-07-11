#!/bin/bash
set -e

echo "╔═══════════════════════════════════════════════════════╗"
echo "║            🗑️  PrivMail Deinstallation                ║"
echo "╚═══════════════════════════════════════════════════════╝"

COMPOSE="docker compose"
if ! docker compose version &>/dev/null; then
    if command -v docker-compose &>/dev/null; then
        COMPOSE="docker-compose"
    fi
fi

read -p "Alle Container stoppen und entfernen? [j/N] " confirm
if [[ "$confirm" =~ ^[jJyY]$ ]]; then
    $COMPOSE down
    echo "✅ Container entfernt."
fi

read -p "Auch alle Daten (data/) löschen? Dies kann NICHT rückgängig gemacht werden! [j/N] " confirm_data
if [[ "$confirm_data" =~ ^[jJyY]$ ]]; then
    rm -rf data/
    echo "✅ Daten gelöscht."
fi

echo "Deinstallation abgeschlossen."
