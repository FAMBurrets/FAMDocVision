// File storage service
// Creates data URLs for images and videos
// Converts HEIC to JPEG via server (local dev only)

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

async function convertMovToMp4(file: File): Promise<{ name: string; dataUrl: string }> {
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
  return { name: result.name, dataUrl: result.dataUrl };
}

async function convertHeicToJpeg(file: File): Promise<{ name: string; dataUrl: string }> {
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
  return { name: result.name, dataUrl: result.dataUrl };
}

export function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function processFiles(
  files: File[],
  type: 'video' | 'image'
): Promise<Array<{ id: string; name: string; url: string; type: typeof type }>> {
  const results = await Promise.all(
    files.map(async (file) => {
      let url: string;
      let name = file.name;

      // PRODUCTION: Only accept web-friendly formats
      if (IS_PRODUCTION) {
        if (type === 'image') {
          if (!isWebFriendlyImage(file)) {
            alert(`${file.name}: Only JPG, PNG, GIF, and WebP images are supported. Please convert HEIC files before uploading.`);
            return null;
          }
          url = await fileToDataUrl(file);
        } else if (type === 'video') {
          if (!isWebFriendlyVideo(file)) {
            alert(`${file.name}: Only MP4 and WebM videos are supported. Please convert MOV files before uploading.`);
            return null;
          }
          url = await fileToDataUrl(file);
        } else {
          url = await fileToDataUrl(file);
        }
      }
      // LOCAL DEV: Use conversion server
      else {
        if (type === 'image') {
          try {
            console.log('Processing image:', file.name);
            const converted = await convertHeicToJpeg(file);
            url = converted.dataUrl;
            name = converted.name;
            console.log('Image processed successfully:', name);
          } catch (error) {
            console.error('Image processing failed:', error);
            // Fall back to direct data URL if conversion fails
            url = await fileToDataUrl(file);
          }
        }
        // Convert MOV to MP4 via server
        else if (type === 'video' && isMovFile(file)) {
          try {
            console.log('Converting MOV:', file.name);
            const converted = await convertMovToMp4(file);
            url = converted.dataUrl;
            name = converted.name;
            console.log('Video converted successfully:', name);
          } catch (error) {
            console.error('MOV conversion failed:', error);
            alert(`Failed to convert ${file.name}. Large videos may take time - check if conversion server is running.`);
            return null;
          }
        }
        else {
          url = await fileToDataUrl(file);
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        name,
        url,
        type,
      };
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}
