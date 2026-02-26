# DocVision Architecture

## Overview

DocVision is a media management platform built for Fam Brands. It allows users to organize, convert, and manage media files (images and videos) through a web interface.

## System Architecture

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
          │  PostgreSQL    │   │  Node.js + sharp     │
          └────────────────┘   └──────────────────────┘
```

## Components

### Frontend (React SPA)
- **Framework:** React 19 + TypeScript
- **Build tool:** Vite 6
- **Hosting:** Azure Static Web Apps (Free tier)
- **URL:** `https://witty-plant-09b070410.6.azurestaticapps.net`
- **Features:** File upload, folder management, media preview, AI-powered features (Gemini)

### Conversion Server (Express API)
- **Runtime:** Node.js 20 LTS
- **Framework:** Express 5
- **Hosting:** Azure App Service (B1 Linux)
- **URL:** `https://docvision-api.azurewebsites.net`
- **Purpose:** Converts media files between formats
  - Image conversion (HEIC/PNG/BMP/GIF/TIFF → JPEG) via `sharp`
  - Video conversion (MOV → MP4) via `ffmpeg` (not yet available in production)

### Database & Authentication
- **Provider:** Supabase Cloud
- **Database:** PostgreSQL
- **Auth:** Azure AD OAuth (Microsoft Entra ID)
- **Project URL:** `https://elmijwfarrxhvgsdtuje.supabase.co`
- **Domain restriction:** Only `@fambrands.com` email addresses can sign in

## Authentication Flow

1. User visits the Static Web App
2. Clicks "Sign in with Microsoft"
3. Supabase redirects to Azure AD login
4. User authenticates with their `@fambrands.com` credentials
5. Azure AD redirects back to Supabase callback (`/auth/v1/callback`)
6. Supabase issues a JWT token
7. React app receives the token and the user is authenticated
8. The app validates the email domain is `@fambrands.com`

## API Endpoints (Conversion Server)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/convert` | API Key | Convert image to JPEG |
| POST | `/convert-video` | API Key | Convert video to MP4 |

All authenticated endpoints require an `X-API-Key` header.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 6, Lucide Icons |
| Backend | Node.js 20, Express 5, sharp, multer |
| Database | PostgreSQL (Supabase) |
| Auth | Azure AD OAuth via Supabase Auth |
| AI | Google Gemini AI |
| Hosting | Azure Static Web Apps, Azure App Service |
| CI/CD | GitHub Actions |
| Local Dev | Docker Compose (Supabase stack) |
