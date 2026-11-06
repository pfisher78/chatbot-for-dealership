# Deploying a live demo (Railway)

Total time: ~30 minutes. Cost: ~$5/month (Hobby plan) + Claude API usage.

## One-time setup

1. Push this repo to GitHub (private repo is fine):
   ```bash
   git remote add origin git@github.com:YOURUSER/dealership-chatbot.git
   git push -u origin claude/car-dealership-chatbot-lzlw8j:main
   ```
2. Create an account at railway.com (sign in with GitHub).
3. Get an Anthropic API key at platform.claude.com and set a spend limit
   (e.g. £20/month) under Settings → Limits.

## Deploy

1. Railway dashboard → **New Project → Deploy from GitHub repo** → select the repo.
   Railway detects the Dockerfile automatically.
2. In the service → **Variables**, add:
   - `ANTHROPIC_API_KEY` = your key
   - `ADMIN_TOKEN` = a long random string (this protects the leads dashboard —
     generate one with `openssl rand -hex 24`)
   - `CLAUDE_MODEL` = `claude-sonnet-4-6` (already the default)
3. In the service → **Settings → Volumes → Add volume**, mount path: `/data`.
   This is where leads and appointments persist across deploys. Without it,
   every redeploy wipes your leads.
4. **Settings → Networking → Generate Domain**. You get a URL like
   `dealership-chatbot-production.up.railway.app`.

## Verify

- `https://<your-domain>/` — demo dealership page with the widget
- `https://<your-domain>/admin.html` — enter your ADMIN_TOKEN, book a test
  appointment through the widget, confirm it appears here
- Redeploy once (Deployments → Redeploy) and confirm the appointment survived
  (proves the volume works)

## Per-client deployments

Each paying dealership = a new Railway service from the same repo, with:
- its own `config/clients/<name>.json` (see docs/WHITE_LABEL.md)
- `DEALERSHIP_CONFIG=./config/clients/<name>.json` in Variables
- its own `ADMIN_TOKEN`
- a custom domain if they want one (Settings → Networking → Custom Domain,
  e.g. `chat.theirdealership.co.uk` via a CNAME record)

The client embeds one line on their website:
```html
<script src="https://<their-service-domain>/widget.js" async></script>
```

## Showing it to a prospect

The strongest demo is the widget on *their* site, not yours. Two options:
1. **Zero-touch**: save a copy of their homepage (right-click → Save Page As),
   add the script tag, host the copy anywhere static — screenshots/video of
   their own site answering questions about "their" stock sells itself.
2. Ask them to paste the script tag into their site footer for a live trial —
   good qualification signal: if they won't paste one line, they won't pay.
