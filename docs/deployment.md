# Deployment Guide

## Azure Resources

All resources are in resource group **`rg-docvision`** (West US 2), subscription `Azure subscription 1`.

| Resource | Type | Name | URL |
|----------|------|------|-----|
| Frontend | Static Web App (Free) | `docvision` | `https://witty-plant-09b070410.6.azurestaticapps.net` |
| API | App Service (B1 Linux) | `docvision-api` | `https://docvision-api.azurewebsites.net` |
| App Service Plan | Linux B1 | `plan-docvision` | — |
| App Registration | Azure AD | `FAM DocVision` | — |
| Deploy Service Principal | Azure AD | `github-docvision-deploy` | — |

### Azure AD App Registration

- **App Name:** FAM DocVision
- **Client ID:** `a9aad0fb-7923-45ef-81ef-6164aac0eea4`
- **Tenant ID:** `f6e7449b-d39b-4300-822f-79267def3ab3`
- **Sign-in audience:** AzureADMyOrg (FamBrands users only)
- **Redirect URI:** `https://elmijwfarrxhvgsdtuje.supabase.co/auth/v1/callback`

## CI/CD Pipelines

### Frontend: Azure Static Web Apps CI/CD

**Workflow:** `.github/workflows/azure-static-web-apps-witty-plant-09b070410.yml`

**Triggers:**
- Push to `main` (any file)
- Pull requests to `main` (creates preview environments)

**What it does:**
1. Checks out the code
2. Builds the React SPA (`npm run build` → `dist/`)
3. Deploys to Azure Static Web Apps with CDN

**Build-time environment variables** (injected during build):
- `VITE_SUPABASE_URL` — hardcoded in workflow
- `VITE_SUPABASE_ANON_KEY` — from GitHub secret
- `VITE_CONVERT_SERVER` — hardcoded in workflow
- `VITE_CONVERT_API_KEY` — from GitHub secret

### Conversion Server: Deploy Conversion Server

**Workflow:** `.github/workflows/deploy-conversion-server.yml`

**Triggers:**
- Push to `main` when these paths change:
  - `server/**`
  - `package.json`
  - `package-lock.json`
  - `.github/workflows/deploy-conversion-server.yml`
- Manual trigger (`workflow_dispatch`)

**What it does:**
1. Checks out the code
2. Sets up Node.js 20
3. Installs production dependencies (`npm install --omit=dev`)
4. Logs in to Azure via service principal
5. Deploys to Azure App Service via zip deploy

**Authentication:** Uses `azure/login@v2` with service principal credentials stored as GitHub secrets.

## GitHub Secrets

The following secrets must be configured in the GitHub repository (Settings → Secrets → Actions):

| Secret | Purpose | Used by |
|--------|---------|---------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_WITTY_PLANT_09B070410` | Static Web App deploy token | Frontend workflow |
| `VITE_SUPABASE_ANON_KEY` | Supabase public API key | Frontend workflow (build-time) |
| `VITE_CONVERT_API_KEY` | Conversion server API key | Frontend workflow (build-time) |
| `AZURE_CLIENT_ID` | Service principal client ID | Conversion server workflow |
| `AZURE_CLIENT_SECRET` | Service principal secret | Conversion server workflow |
| `AZURE_TENANT_ID` | Azure tenant ID | Conversion server workflow |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Conversion server workflow |

## App Service Configuration

The conversion server App Service has the following app settings:

| Setting | Value | Purpose |
|---------|-------|---------|
| `CONVERT_API_KEY` | (secret) | API key for authenticating conversion requests |
| `ALLOWED_ORIGINS` | `https://witty-plant-09b070410.6.azurestaticapps.net` | CORS allowed origins |
| `MAX_FILE_SIZE` | `104857600` | Max upload size (100MB) |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` | Disable Oryx build (deps pre-built in CI) |
| `WEBSITES_CONTAINER_START_TIME_LIMIT` | `600` | Extended startup timeout (seconds) |

**Startup command:** `node server/convert.cjs`

## Supabase Configuration

### Authentication Providers

**Azure (Microsoft):**
- Client ID: `a9aad0fb-7923-45ef-81ef-6164aac0eea4`
- Client Secret: (stored in Azure AD app registration)
- Azure Tenant URL: `https://login.microsoftonline.com/f6e7449b-d39b-4300-822f-79267def3ab3`

### URL Configuration

- **Site URL:** `https://witty-plant-09b070410.6.azurestaticapps.net`
- **Redirect URLs:** `http://localhost:3000` (for local development)

## Manual Deployment

### Frontend

Push to `main` triggers automatic deployment. No manual steps needed.

### Conversion Server

To manually trigger a deployment:

```bash
gh workflow run "Deploy Conversion Server" --repo FAMBurrets/FAMDocVision
```

Or via Azure CLI:

```bash
# Install production deps for Linux
npm install --omit=dev --os=linux --cpu=x64 --libc=glibc

# Deploy
az webapp deployment source config-zip \
  --name docvision-api \
  --resource-group rg-docvision \
  --src <zip-file>
```

## Estimated Monthly Cost

| Resource | Cost |
|----------|------|
| Static Web Apps (Free tier) | $0 |
| App Service (B1 Linux) | ~$13 |
| Supabase Cloud | Per your plan |
| **Total Azure cost** | **~$13/month** |

## Known Limitations

1. **No ffmpeg in production** — Video conversion (MOV→MP4) requires ffmpeg which is not currently installed on the App Service. Image conversion (sharp) works. To add ffmpeg, consider using a custom Docker container.
2. **Cold start latency** — The B1 App Service may have cold starts after periods of inactivity (~15-30s).
3. **No custom domain** — Both services use default Azure URLs. Custom domains can be added later.
4. **No staging environment** — Deployments go directly to production. Consider adding a staging slot for the App Service.
