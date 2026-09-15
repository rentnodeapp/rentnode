@echo off
rem Runs the relay with the values in .env. Keep this window open; closing it stops fulfilment.
cd /d "%~dp0"
node --env-file=.env index.mjs
