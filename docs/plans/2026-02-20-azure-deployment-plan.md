# Azure Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy DocVision to Azure with Static Web Apps (frontend) and App Service (conversion server), using Azure AD auth via Supabase.

**Architecture:** React SPA on Azure Static Web Apps (free CDN + SSL), Express conversion server on Azure App Service B1 with sharp + ffmpeg, Supabase Cloud for auth and database.

**Tech Stack:** Azure CLI, Azure Static Web Apps, Azure App Service, Node.js 20, sharp, ffmpeg, GitHub Actions

---

### Task 1: Update Conversion Server for Cross-Platform Support

The current `server/convert.cjs` uses macOS-only `sips` and `avconvert`. Replace with `sharp` (images) and `ffmpeg` (video) which work on Linux.

**Files:**
- Modify: `server/convert.cjs:90-134` (image conversion route)
- Modify: `server/convert.cjs:136-178` (video conversion route)

**Step 1: Update the image conversion route to use sharp**

Replace the `/convert` route handler in `server/convert.cjs` (lines 90-134). Remove `sips` usage, use `sharp` instead:

```javascript
const sharp = require('sharp');

// Convert any image to JPEG using sharp (cross-platform)
app.post('/convert', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Converting:', req.file.originalname);

    const jpegBuffer = await sharp(req.file.buffer)
      .jpeg({ quality: 90 })
      .toBuffer();

    const base64 = jpegBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    console.log('Converted successfully:', req.file.originalname);

    const baseName = req.file.originalname.replace(/\.(heic|heif|png|gif|bmp|tiff?)$/i, '');
    res.json({
      success: true,
      name: baseName + '.jpg',
      dataUrl
    });
  } catch (error) {
    console.error('Conversion error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
```

**Step 2: Update the video conversion route to use ffmpeg**

Replace the `/convert-video` route handler in `server/convert.cjs` (lines 136-178). Replace `avconvert` with `ffmpeg`:

```javascript
// Convert MOV to MP4 using ffmpeg (cross-platform)
app.post('/convert-video', authenticate, upload.single('file'), async (req, res) => {
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input-${Date.now()}.mov`);
  const outputPath = path.join(tempDir, `output-${Date.now()}.mp4`);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Converting video:', req.file.originalname);

    fs.writeFileSync(inputPath, req.file.buffer);

    execSync(`ffmpeg -i "${inputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart -y "${outputPath}"`, {
      stdio: 'pipe',
      timeout: 300000
    });

    const mp4Buffer = fs.readFileSync(outputPath);
    const base64 = mp4Buffer.toString('base64');
    const dataUrl = `data:video/mp4;base64,${base64}`;

    console.log('Video converted successfully:', req.file.originalname);

    res.json({
      success: true,
      name: req.file.originalname.replace(/\.mov$/i, '.mp4'),
      dataUrl
    });
  } catch (error) {
    console.error('Video conversion error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    try { fs.unlinkSync(inputPath); } catch (e) {}
    try { fs.unlinkSync(outputPath); } catch (e) {}
  }
});
```

**Step 3: Remove unused imports**

Remove `const { execSync } = require('child_process');` only if no other code uses it. Since video conversion still uses `execSync` for ffmpeg, keep it. But remove `const fs = require('fs')` ... no, video still uses `fs`. Keep all imports.

Actually — the sharp conversion no longer needs temp files, so the only change to imports is adding sharp at the top:

Add `const sharp = require('sharp');` after line 7 in `server/convert.cjs`.

**Step 4: Test locally**

Run: `npm run server`
Expected: Server starts on port 3006, `/health` returns `{ "status": "ok" }`

**Step 5: Commit**

```bash
git add server/convert.cjs
git commit -m "refactor: replace macOS sips/avconvert with sharp/ffmpeg for cross-platform support"
```

---

### Task 2: Create Azure App Service for Conversion Server

**Step 1: Create App Service Plan**

```bash
az appservice plan create \
  --name plan-docvision \
  --resource-group rg-docvision \
  --sku B1 \
  --is-linux
```

**Step 2: Create the Web App**

```bash
az webapp create \
  --name docvision-api \
  --resource-group rg-docvision \
  --plan plan-docvision \
  --runtime "NODE:20-lts"
```

Note: if `docvision-api` is taken, try `docvision-api-fam` or similar. The URL will be `https://<name>.azurewebsites.net`.

**Step 3: Create a startup script for ffmpeg**

Create file `server/startup.sh`:

```bash
#!/bin/bash
apt-get update && apt-get install -y ffmpeg
node server/convert.cjs
```

**Step 4: Configure the App Service**

```bash
# Set startup command
az webapp config set \
  --name docvision-api \
  --resource-group rg-docvision \
  --startup-file "server/startup.sh"

# Set environment variables
az webapp config appsettings set \
  --name docvision-api \
  --resource-group rg-docvision \
  --settings \
    CONVERT_API_KEY="<generate-a-strong-key>" \
    ALLOWED_ORIGINS="https://<static-web-app-url>" \
    MAX_FILE_SIZE=104857600
```

**Step 5: Deploy the conversion server**

```bash
# From repo root, zip deploy the server
az webapp deploy \
  --name docvision-api \
  --resource-group rg-docvision \
  --src-path . \
  --type zip
```

**Step 6: Verify deployment**

```bash
curl https://docvision-api.azurewebsites.net/health
```

Expected: `{ "status": "ok" }`

**Step 7: Commit startup script**

```bash
git add server/startup.sh
git commit -m "feat: add App Service startup script with ffmpeg install"
```

---

### Task 3: Create Azure Static Web App for Frontend

**Step 1: Create the Static Web App**

```bash
az staticwebapp create \
  --name docvision \
  --resource-group rg-docvision \
  --source https://github.com/FAMBurrets/FAMDocVision \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --login-with-github
```

This will open a browser to authenticate with GitHub and set up the GitHub Actions workflow automatically.

**Step 2: Configure environment variables**

```bash
az staticwebapp appsettings set \
  --name docvision \
  --resource-group rg-docvision \
  --setting-names \
    VITE_SUPABASE_URL="https://elmijwfarrxhvgsdtuje.supabase.co" \
    VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbWlqd2ZhcnJ4aHZnc2R0dWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDQ0MzQsImV4cCI6MjA4NzAyMDQzNH0.QObUDCF_WSwBuL5Q7z_MYsdRstJDfhEPJjs2ivx2cf8" \
    VITE_CONVERT_SERVER="https://docvision-api.azurewebsites.net" \
    VITE_CONVERT_API_KEY="<same-strong-key-from-task-2>"
```

**Step 3: Verify the GitHub Actions workflow was created**

Check that `.github/workflows/azure-static-web-apps-*.yml` was created in the repo.

**Step 4: Verify deployment**

Visit the Static Web App URL shown in the Azure portal (e.g. `https://<generated-name>.azurestaticapps.net`).
Expected: DocVision login screen loads.

**Step 5: Commit any workflow changes**

```bash
git add .github/
git commit -m "feat: add Azure Static Web Apps CI/CD workflow"
```

---

### Task 4: Update CORS and Connect Services

**Step 1: Update App Service ALLOWED_ORIGINS with actual Static Web App URL**

```bash
# Get the Static Web App hostname
az staticwebapp show --name docvision --resource-group rg-docvision --query "defaultHostname" -o tsv

# Update App Service CORS
az webapp config appsettings set \
  --name docvision-api \
  --resource-group rg-docvision \
  --settings ALLOWED_ORIGINS="https://<actual-static-web-app-hostname>"
```

**Step 2: Update Azure AD app registration redirect URI (if needed)**

If using a custom domain later:

```bash
az ad app update \
  --id a9aad0fb-7923-45ef-81ef-6164aac0eea4 \
  --web-redirect-uris "https://elmijwfarrxhvgsdtuje.supabase.co/auth/v1/callback"
```

**Step 3: Test end-to-end**

1. Visit Static Web App URL
2. Click "Sign in with Azure"
3. Authenticate with `@fambrands.com` account
4. Verify app loads after login
5. Test file conversion (upload a HEIC image, upload a MOV video)

---

### Task 5: Configure Supabase Azure Provider

This is done in the Supabase Dashboard (not CLI).

**Step 1: Enable Azure provider in Supabase**

1. Go to https://supabase.com/dashboard → DocVision project
2. Navigate to Authentication → Providers
3. Enable **Azure**
4. Set:
   - Client ID: `a9aad0fb-7923-45ef-81ef-6164aac0eea4`
   - Client Secret: (stored in Azure AD app registration — retrieve from Azure portal)
   - Azure Tenant URL: `https://login.microsoftonline.com/f6e7449b-d39b-4300-822f-79267def3ab3`
5. Save

**Step 2: Verify auth flow**

1. Visit the deployed Static Web App
2. Click "Sign in with Azure"
3. Should redirect to Microsoft login → back to app as authenticated user
