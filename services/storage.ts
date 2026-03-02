// File storage service
// Uploads files to Supabase Storage and returns public URLs

import { supabase } from './supabase';

const CONVERT_SERVER = import.meta.env.VITE_CONVERT_SERVER || 'http://localhost:3006';
const CONVERT_API_KEY = import.meta.env.VITE_CONVERT_API_KEY || 'dev-convert-key-change-in-production';
const IS_PRODUCTION = import.meta.env.PROD;

function isHeicFile(file: File): boolean {
  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  );
}

function isMovFile(file: File): boolean {
  return (
    file.type === 'video/quicktime' ||
    file.name.toLowerCase().endsWith('.mov')
  );
}

function isWebFriendlyImage(file: File): boolean {
  const webTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const webExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = file.name.toLowerCase();
  return webTypes.includes(file.type) || webExtensions.some(e => ext.endsWith(e));
}

function isWebFriendlyVideo(file: File): boolean {
  const webTypes = ['video/mp4', 'video/webm'];
  const webExtensions = ['.mp4', '.webm'];
  const ext = file.name.toLowerCase();
  return webTypes.includes(file.type) || webExtensions.some(e => ext.endsWith(e));
}

async function convertMovToMp4(file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${CONVERT_SERVER}/convert-video`, {
    method: 'POST',
    headers: {
      'X-API-Key': CONVERT_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Video conversion failed');
  }

  const result = await response.json();
  // Convert base64 back to blob for upload
  const base64Data = result.dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'video/mp4' });
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${CONVERT_SERVER}/convert`, {
    method: 'POST',
    headers: {
      'X-API-Key': CONVERT_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Conversion failed');
  }

  const result = await response.json();
  // Convert base64 back to blob for upload
  const base64Data = result.dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'image/jpeg' });
}

function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.split('.').pop() || '';
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
  return `${baseName}_${timestamp}_${random}.${ext}`;
}

async function uploadToStorage(file: Blob, fileName: string, type: 'video' | 'image'): Promise<string> {
  const folder = type === 'video' ? 'videos' : 'images';
  const path = `${folder}/${generateUniqueFileName(fileName)}`;

  console.log('Uploading to storage:', path, 'size:', file.size);

  const { data, error } = await supabase.storage
    .from('media')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('media')
    .getPublicUrl(data.path);

  console.log('Upload complete:', urlData.publicUrl);
  return urlData.publicUrl;
}

export async function processFiles(
  files: File[],
  type: 'video' | 'image'
): Promise<Array<{ id: string; name: string; url: string; type: typeof type }>> {
  const results = await Promise.all(
    files.map(async (file) => {
      let fileToUpload: Blob = file;
      let name = file.name;

      // PRODUCTION: Only accept web-friendly formats
      if (IS_PRODUCTION) {
        if (type === 'image') {
          if (!isWebFriendlyImage(file)) {
            alert(`${file.name}: Only JPG, PNG, GIF, and WebP images are supported. Please convert HEIC files before uploading.`);
            return null;
          }
        } else if (type === 'video') {
          if (!isWebFriendlyVideo(file)) {
            alert(`${file.name}: Only MP4 and WebM videos are supported. Please convert MOV files before uploading.`);
            return null;
          }
        }
      }
      // LOCAL DEV: Use conversion server
      else {
        if (type === 'image' && isHeicFile(file)) {
          try {
            console.log('Converting HEIC:', file.name);
            fileToUpload = await convertHeicToJpeg(file);
            name = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
            console.log('HEIC converted successfully');
          } catch (error) {
            console.error('HEIC conversion failed:', error);
            // Continue with original file
          }
        }
        else if (type === 'video' && isMovFile(file)) {
          try {
            console.log('Converting MOV:', file.name);
            fileToUpload = await convertMovToMp4(file);
            name = file.name.replace(/\.mov$/i, '.mp4');
            console.log('MOV converted successfully');
          } catch (error) {
            console.error('MOV conversion failed:', error);
            alert(`Failed to convert ${file.name}. Large videos may take time - check if conversion server is running.`);
            return null;
          }
        }
      }

      try {
        const url = await uploadToStorage(fileToUpload, name, type);
        return {
          id: Math.random().toString(36).substr(2, 9),
          name,
          url,
          type,
        };
      } catch (error) {
        console.error('Upload failed:', error);
        alert(`Failed to upload ${name}. Please try again.`);
        return null;
      }
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}
