#!/bin/sh
set -eu

mkdir -p \
  storage/framework/cache \
  storage/framework/sessions \
  storage/framework/testing \
  storage/framework/views \
  storage/logs \
  bootstrap/cache \
  database

if [ ! -f database/database.sqlite ]; then
  touch database/database.sqlite
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  php artisan migrate --force
fi

exec "$@"
