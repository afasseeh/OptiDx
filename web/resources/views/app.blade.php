<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>{{ config('app.name', 'OptiDx') }}</title>
        <link rel="icon" type="image/png" sizes="32x32" href="{{ asset('favicon.png') }}">
        <link rel="icon" type="image/png" sizes="192x192" href="{{ asset('favicon.png') }}">
        <link rel="apple-touch-icon" href="{{ asset('favicon.png') }}">
        <meta name="msapplication-TileImage" content="{{ asset('favicon.png') }}">
        @vite(['resources/js/app.js'])
    </head>
    <body>
        <div id="app"></div>
    </body>
</html>
