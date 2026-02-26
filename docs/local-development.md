# Local Development Guide

## Prerequisites

- Node.js 20+
- npm
- Docker & Docker Compose (for local Supabase)
- Git

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/FAMBurrets/FAMDocVision.git
cd FAMDocVision
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values. For local development with Docker Supabase, the defaults work out of the box.

For development against Supabase Cloud:

```
VITE_SUPABASE_URL=https://elmijwfarrxhvgsdtuje.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Start local Supabase (optional)

If using the local Docker Supabase stack:

```bash
npm run docker:up
npm run db:init
```

### 4. Start the development servers

In two separate terminals:

```bash
# Terminal 1: Frontend (Vite dev server)
npm run dev
# → http://localhost:3000

# Terminal 2: Conversion server
npm run server
# → http://localhost:3006
```

### 5. Sign in

- **Azure AD:** Click "Sign in with Microsoft" (requires Supabase Azure provider configured)
- **Dev mode:** Click "Admin Login (Dev)" with credentials `admin` / `DocVision2024!`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Google Gemini AI API key |
| `VITE_SUPABASE_URL` | `http://localhost:8000` | Supabase API URL |
| `VITE_SUPABASE_ANON_KEY` | (local demo key) | Supabase anonymous/public key |
| `VITE_CONVERT_SERVER` | `http://localhost:3006` | Conversion server URL |
| `VITE_CONVERT_API_KEY` | `dev-convert-key-change-in-production` | API key for conversion server |
| `CONVERT_API_KEY` | `dev-convert-key-change-in-production` | Server-side API key (must match above) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | CORS allowed origins |
| `MAX_FILE_SIZE` | `104857600` | Max upload size in bytes (100MB) |
| `ENABLE_RLS` | `false` | Enable Row Level Security |

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run server` | Start conversion server on port 3006 |
| `npm run build` | Build production frontend to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run docker:up` | Start local Supabase Docker stack |
| `npm run docker:down` | Stop local Supabase Docker stack |
| `npm run docker:logs` | Tail Docker logs |
| `npm run db:init` | Initialize database schema |
| `npm run db:reset` | Reset database (destroys data) |

## Project Structure

```
FAMDocVision/
├── .github/workflows/     # CI/CD pipelines
├── components/            # React components
│   └── LoginScreen.tsx    # Login page
├── contexts/
│   └── AuthContext.tsx     # Authentication state management
├── docs/                  # Documentation
├── public/                # Static assets (logos, images)
├── scripts/               # Database init scripts
├── server/
│   └── convert.cjs        # Express conversion server
├── services/
│   ├── supabase.ts        # Supabase client
│   ├── database.ts        # Database service
│   └── storage.ts         # File storage & conversion client
├── supabase/              # Supabase configuration
├── App.tsx                # Main React component
├── index.tsx              # React entry point
├── index.html             # HTML template
├── types.ts               # TypeScript type definitions
├── vite.config.ts         # Vite configuration
├── docker-compose.yml     # Local Supabase stack
├── package.json           # Dependencies & scripts
└── tsconfig.json          # TypeScript configuration
```

## Docker Services (Local Supabase)

When running `npm run docker:up`, the following services start:

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database |
| Supabase Auth (GoTrue) | 9999 | Authentication |
| Supabase API (Kong) | 8000 | REST API gateway |

## Troubleshooting

### "Cannot find module" errors when running the conversion server
Run `npm install` to ensure all dependencies are installed.

### Azure sign-in redirects to localhost
This is expected for local development. The Supabase redirect URL includes `http://localhost:3000`.

### HEIC conversion not working
Ensure `sharp` is installed correctly: `npm install sharp`. On some systems you may need build tools.

### Docker Supabase won't start
Check Docker is running: `docker info`. Then try `npm run db:reset` to recreate the containers.
