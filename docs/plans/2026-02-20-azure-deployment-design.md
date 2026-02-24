# DocVision Azure Deployment Design

## Architecture

- **Frontend**: Azure Static Web Apps (Free tier) — serves Vite-built React SPA with global CDN, SSL
- **Conversion Server**: Azure App Service (B1, ~$13/mo) — Node.js Express with sharp + ffmpeg
- **Database & Auth**: Supabase Cloud — Azure AD OAuth, PostgreSQL
- **Resource Group**: `rg-docvision` (West US 2)

```
                    ┌─────────────────────┐
                    │   FamBrands Users    │
                    │  (Azure AD / Entra)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Azure Static Web   │
                    │  Apps (React SPA)   │
                    │  + Global CDN + SSL │
                    └──┬──────────────┬───┘
                       │              │
          ┌────────────▼───┐   ┌──────▼──────────────┐
          │  Supabase Cloud│   │  Azure App Service   │
          │  (Auth + DB)   │   │  (Conversion Server) │
          │                │   │  Node.js + ffmpeg     │
          └────────────────┘   └──────────────────────┘
```

## Conversion Server Changes

| Current (macOS) | Production (Linux) | Library |
|---|---|---|
| `sips -s format jpeg` | `sharp` (already in package.json) | Image conversion |
| `avconvert` | `ffmpeg` (installed on App Service) | Video conversion |

- sharp handles HEIC/PNG/BMP/GIF/TIFF → JPEG natively
- ffmpeg installed via App Service startup script
- Same API endpoints (`/convert`, `/convert-video`), same request/response shape

## Deployment Configuration

### Static Web Apps (Frontend)
- Linked to GitHub repo, auto-deploys on push to `main`
- Build: `npm run build`, output: `dist`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CONVERT_SERVER`

### App Service (Conversion Server)
- Node.js 20 LTS
- Startup: `node server/convert.cjs`
- ffmpeg via startup script (`apt-get install -y ffmpeg`)
- Env vars: `CONVERT_API_KEY`, `ALLOWED_ORIGINS`
- CORS allows Static Web App origin

### Auth Flow
1. User visits Static Web App → React loads
2. "Sign in with Azure" → Supabase redirects to Azure AD
3. Azure AD authenticates → redirects to Supabase callback
4. Supabase issues JWT → app authenticated
5. Conversion requests go to App Service with API key header

### Azure AD App Registration
- App Name: FAM DocVision
- Client ID: `a9aad0fb-7923-45ef-81ef-6164aac0eea4`
- Tenant ID: `f6e7449b-d39b-4300-822f-79267def3ab3`
- Audience: AzureADMyOrg (FamBrands only)
- Redirect URI: `https://elmijwfarrxhvgsdtuje.supabase.co/auth/v1/callback`

## Estimated Cost
- Static Web Apps: Free
- App Service B1: ~$13/mo
- Supabase Cloud: existing plan
