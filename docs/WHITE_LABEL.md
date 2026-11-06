# White-Label Guide — Deploying for a New Dealership (UK)

Every dealership you sell to gets its own deployment of this codebase. Rebranding is a **configuration change only** — you never touch the source.

## Step 1: Copy the config

`config/dealership.config.json` is the single source of truth for everything dealership-specific. Duplicate it per client:

```bash
cp config/dealership.config.json config/clients/rivertown-motors.json
```

Point the deployment at it via `.env`:

```
DEALERSHIP_CONFIG=./config/clients/rivertown-motors.json
```

## Step 2: Fill in the sections

### `dealership` — business facts the AI answers from

```jsonc
{
  "name": "Rivertown Motors",
  "tagline": "Drive happy",
  "brands": ["Suzuki", "Mazda"],
  "address": "...",
  "phone": "0161 ...",
  "email": "...",
  "companyNumber": "01234567",     // Companies House number
  "vatNumber": "GB123456789",
  "hours": { "sales": { ... }, "service": { ... } },
  "pricing": {
    "vatIncluded": true,           // advertised prices include VAT
    "adminFeeGbp": 199,            // 0 if the dealer doesn't charge one
    "adminFeeNote": "A £199 admin fee applies to all vehicle sales and is always disclosed up front."
  },
  "specialOffers": [ ... ]         // current promotions the bot can quote
}
```

### `dealership.financing` — READ THIS ONE CAREFULLY (FCA)

Consumer car finance is FCA-regulated. The bot never calculates payments; it can only present the dealer's pre-approved representative example. Two modes:

```jsonc
"financing": {
  // "representative_example" or "disabled"
  "mode": "representative_example",

  // ⚠️ Your sign-off gate. Leave false until the dealer principal (or their
  // compliance contact) has approved the exact disclosure text and every
  // figure in the representative example below. While false, finance
  // discussion is disabled regardless of mode.
  "approvedByDealer": false,

  // The dealer's own FCA status line — FRN, broker-not-lender status,
  // commission disclosure, "subject to status" wording. Use their existing
  // website finance page wording; do not write this for them.
  "fcaDisclosure": "Rivertown Motors Ltd is a credit broker, not a lender, authorised and regulated by the Financial Conduct Authority (FRN ______). ...",

  // The signed-off worked example, presented verbatim by the bot and always
  // labelled "Representative example".
  "representativeExample": {
    "description": "Hire Purchase (HP)",
    "cashPriceGbp": 15000,
    "depositGbp": 1500,
    "amountOfCreditGbp": 13500,
    "termMonths": 48,
    "monthlyPaymentGbp": 329.67,
    "optionToPurchaseFeeGbp": 10,
    "totalAmountPayableGbp": 17334.16,
    "aprRepresentativePercent": 9.9,
    "fixedInterestRatePerAnnumPercent": 5.09
  }
}
```

If a dealer doesn't want finance in the bot at all, set `"mode": "disabled"` — the finance tool is then not registered with the AI, and every finance question is referred to their finance team.

**Sales tip:** raise this in the demo, not after. Dealer principals ask about it, and having a per-client sign-off gate + disable switch is a selling point, not a weakness.

### `branding` — how the widget looks and speaks

```jsonc
{
  "primaryColor": "#0f6b3f",       // header, launcher bubble, customer messages
  "accentColor": "#d94f2b",        // send button
  "backgroundColor": "#ffffff",
  "textColor": "#1c1c1e",
  "fontFamily": "'Segoe UI', system-ui, sans-serif",
  "logoUrl": "https://client-cdn/logo.png",  // shown in widget header ("" = avatar emoji)
  "botName": "River",              // the assistant's name
  "botAvatar": "🚙",               // launcher icon
  "widgetPosition": "bottom-right",// or "bottom-left"
  "greeting": "Hi! I'm River..."   // first message customers see
}
```

The demo page (`/`) and the widget both restyle themselves automatically from these values.

### `behavior` — conversation policy

```jsonc
{
  "leadCaptureMode": "natural",    // the bot asks for contact info when intent shows
  "afterHoursMessage": "...",
  "handoffPhone": "0161 ...",      // where "talk to a human" requests are pointed
  "languages": ["English"]         // add e.g. "Polish", "Welsh" as needed
}
```

## Step 3: Load their stock

Replace `config/inventory.seed.json` with the client's stock (same field shape — prices in GBP inc. VAT, `registration`, `hpiClear`, `mpgCombined` or `rangeMiles`), or — for production — wire `src/data/store.ts` to their DMS/stock feed (Auto Trader Connect, keyloop, Pinewood…). The AI only ever presents what the stock tools return, so it can never invent vehicles or prices.

## Step 4: Deploy and embed

1. Deploy the server (any Node 18+ host: Railway, Render, Fly.io, a UK VPS…). One instance per client keeps data, branding, and billing cleanly separated. Remember UK GDPR: leads and appointments are personal data — host in an appropriate region and agree a data-processing arrangement with the dealer.
2. Set `.env`: `ANTHROPIC_API_KEY`, a **unique** `ADMIN_TOKEN`, and `DEALERSHIP_CONFIG`.
3. Lock CORS to the client's domain in `src/server.ts`.
4. Give the dealership one line for their web agency:

```html
<script src="https://rivertown-chat.yourdomain.co.uk/widget.js" async></script>
```

5. Give the dealership manager the admin dashboard URL + token so they can see leads and appointments.

## What the system prompt inherits automatically

The AI's persona is generated from the config at startup — bot name, dealership name, brands, address, languages, handoff phone, pricing policy, and the FCA finance rules all flow into the system prompt. Changing the config file changes the assistant's identity and its compliance posture; there is no per-client prompt to maintain.

## Pricing note for your business

Each customer conversation costs Claude API tokens (the system prompt is cached, so repeat turns are cheap). Typical short sales conversations cost a few pence. Price your monthly SaaS fee per dealership accordingly, and set per-deployment API keys so you can meter usage per client from the Anthropic Console.
