FROM composer:2 AS vendor

WORKDIR /app

COPY . .
RUN mkdir -p bootstrap/cache
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --optimize-autoloader

FROM node:20-bookworm-slim AS assets

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY resources ./resources
COPY public ./public
COPY vite.config.js ./

RUN npm run build

FROM php:8.3-cli-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        libicu-dev \
        libonig-dev \
        libsqlite3-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-install intl mbstring opcache pdo_sqlite zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY . /var/www/html
COPY --from=vendor /app/vendor /var/www/html/vendor
COPY --from=assets /app/public/build /var/www/html/public/build
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p storage bootstrap/cache database \
    && chown -R www-data:www-data storage bootstrap/cache database

ENV APP_ENV=production \
    APP_DEBUG=false

EXPOSE 8082

ENTRYPOINT ["entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8082"]
