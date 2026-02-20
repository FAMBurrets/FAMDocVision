const express = require('express');
const multer = require('multer');
const cors = require('cors');
const sharp = require('sharp');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Load environment from .env.local if exists
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

const app = express();

// Configuration
const API_KEY = process.env.CONVERT_API_KEY || 'dev-convert-key-change-in-production';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '104857600'); // 100MB default

// Rate limiting - simple in-memory store
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  // Clean old entries
  const requests = (rateLimitStore.get(ip) || []).filter(time => time > windowStart);

  if (requests.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  requests.push(now);
  rateLimitStore.set(ip, requests);
  next();
}

// API key authentication middleware
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or missing API key.' });
  }

  next();
}

// CORS configuration - restrict to allowed origins
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// File size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE }
});

// Apply rate limiting to all routes
app.use(rateLimit);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

const PORT = 3006;
app.listen(PORT, () => {
  console.log(`Conversion server running on http://localhost:${PORT}`);
});
