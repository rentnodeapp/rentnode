@echo off
rem Opens a temporary public URL to the relay on this PC (trycloudflare, no account).
rem Copy the https://....trycloudflare.com line it prints into .env as PUBLIC_URL, then run start-relay.cmd.
cd /d "%~dp0"
if not exist node_modules\.bin\cloudflared.cmd npm i cloudflared --no-save --no-audit --no-fund
node_modules\.bin\cloudflared.cmd tunnel --url http://localhost:8787 --no-autoupdate
