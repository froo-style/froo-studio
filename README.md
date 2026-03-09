# FROO.studio — Slack-Based Tech Pack Generator

An automated apparel production assistant that lives inside Slack. It monitors `#new-samples` for new sample submissions, ingests notes and inspiration images, builds a complete tech pack workflow through a chatbot-style interface, and delivers the final factory-ready output as a Slack Canvas.

## How It Works

1. A user posts a new sample in `#new-samples` with notes and an inspiration image
2. The app detects the post, reads the notes, and downloads the image
3. It asks only the missing details through a chatbot flow in-thread
4. It generates sketches, mockups, and detail callouts via Nano Banana
5. It handles fabric selection (AI suggestions or user upload)
6. It pulls or generates a size chart from Supabase
7. The user approves the tech pack summary
8. The app creates a new Slack channel (`#sample-XXXX`) with a full Canvas tech pack

## Architecture

```
src/
├── index.js              # Main entry — boots Slack Bolt, registers handlers
├── config.js             # Environment config + garment constants
├── slack/
│   ├── client.js         # Slack Bolt app singleton
│   ├── parser.js         # Message parsing & field extraction
│   ├── images.js         # Download images from Slack
│   ├── channels.js       # Create channels, post messages, upload files
│   └── canvas.js         # Create Slack Canvas with tech pack content
├── supabase/
│   ├── client.js         # Supabase client singleton
│   ├── samples.js        # Sample CRUD operations
│   └── sizecharts.js     # Size chart lookups and generation
├── nanobanana/
│   ├── client.js         # Nano Banana API client
│   └── visuals.js        # Full visual generation pipeline
├── workflow/
│   ├── state.js          # In-memory workflow state management
│   ├── questions.js      # Clarifying question definitions & logic
│   ├── chatbot.js        # Chatbot interaction handlers
│   └── pipeline.js       # Main workflow pipeline (all 7 steps)
└── utils/
    ├── ai.js             # Claude & Gemini AI integration
    ├── logger.js         # Structured logging
    └── storage.js        # Local file storage
```

## Setup

### 1. Slack App Configuration

Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) with:

**OAuth Scopes (Bot Token):**
- `channels:history` — read messages in public channels
- `channels:manage` — create channels
- `channels:read` — list channels
- `chat:write` — send messages
- `files:read` — access file content
- `files:write` — upload files
- `canvases:write` — create and write to canvases

**Socket Mode:** Enable and generate an App-Level Token with `connections:write`.

**Event Subscriptions:** Subscribe to `message.channels` bot event.

**Interactivity:** Enable (required for button actions).

### 2. Supabase

1. Create a Supabase project
2. Run the schema in `supabase/schema.sql` in the SQL Editor
3. Copy the project URL and anon key

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

### 4. Install & Run

```bash
npm install
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Workflow Steps

| Step | Name | Description |
|------|------|-------------|
| 1 | **Intake** | Detect sample in Slack, download image, create record |
| 2 | **Clarify** | Chatbot asks only missing production details |
| 3 | **Visuals** | Generate sketches, mockups, callouts via Nano Banana |
| 4 | **Fabric** | AI suggests fabric or user provides their own |
| 5 | **Size Chart** | Pull from Supabase or generate from closest block |
| 6 | **Approval** | User reviews summary and approves or requests edits |
| 7 | **Output** | Create `#sample-XXXX` channel with full Canvas tech pack |

## Canvas Output Sections

1. **Design Overview** — sample info, visuals, factory notes
2. **Fabrics and Trims** — fabric card, supplier, trim details
3. **Size Chart** — measurement table with sample size
4. **Detail Callouts** — zoomed design features
5. **Production Notes** — sewing, finishing, placement instructions

## Integrations

- **Slack** — Channel monitoring, chatbot flow, Canvas output
- **Supabase** — Sample records, size charts, size blocks
- **Nano Banana** — Technical sketches, 3D mockups, background removal, detail callouts
- **Anthropic Claude** — Factory notes, production guidance
- **Google Gemini** — Vision analysis of inspiration images
