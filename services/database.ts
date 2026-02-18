import { Folder, Asset } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export interface DbFolder {
  id: string;
  user_id: string;
  name: string;
  ai_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAsset {
  id: string;
  folder_id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  storage_path: string | null;
  created_at: string;
}

function toAppFolder(dbFolder: DbFolder, assets: DbAsset[]): Folder {
  return {
    id: dbFolder.id,
    name: dbFolder.name,
    videos: assets.filter(a => a.type === 'video').map(a => ({
      id: a.id,
      name: a.name,
      url: a.url,
      type: 'video' as const,
    })),
    images: assets.filter(a => a.type === 'image').map(a => ({
      id: a.id,
      name: a.name,
      url: a.url,
      type: 'image' as const,
    })),
    createdAt: new Date(dbFolder.created_at).getTime(),
    aiDescription: dbFolder.ai_description || undefined,
  };
}

export async function getFolders(userId: string): Promise<Folder[]> {
  try {
    const folders = await fetchApi(`/folders?user_id=eq.${userId}&order=created_at.desc`);

    if (!folders || folders.length === 0) {
      return [];
    }

    const folderIds = folders.map((f: DbFolder) => f.id);
    const assets = await fetchApi(`/assets?folder_id=in.(${folderIds.join(',')})`);

    const assetsByFolder = (assets || []).reduce((acc: Record<string, DbAsset[]>, asset: DbAsset) => {
      if (!acc[asset.folder_id]) acc[asset.folder_id] = [];
      acc[asset.folder_id].push(asset);
      return acc;
    }, {});

    return folders.map((f: DbFolder) => toAppFolder(f, assetsByFolder[f.id] || []));
  } catch (error) {
    console.warn('Database error:', error);
    throw error;
  }
}

export async function createFolder(
  userId: string,
  name: string,
  videos: Asset[],
  images: Asset[]
): Promise<Folder> {
  const [folder] = await fetchApi('/folders', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, name })
  });

  const allAssets = [
    ...videos.map(v => ({ folder_id: folder.id, name: v.name, url: v.url, type: 'video' })),
    ...images.map(i => ({ folder_id: folder.id, name: i.name, url: i.url, type: 'image' })),
  ];

  if (allAssets.length > 0) {
    await fetchApi('/assets', {
      method: 'POST',
      body: JSON.stringify(allAssets)
    });
  }

  return (await getFolderById(folder.id))!;
}

export async function getFolderById(folderId: string): Promise<Folder | null> {
  try {
    const [folder] = await fetchApi(`/folders?id=eq.${folderId}`);
    if (!folder) return null;

    const assets = await fetchApi(`/assets?folder_id=eq.${folderId}`);
    return toAppFolder(folder, assets || []);
  } catch {
    return null;
  }
}

export async function updateFolder(
  folderId: string,
  name: string,
  videos: Asset[],
  images: Asset[]
): Promise<Folder> {
  await fetchApi(`/folders?id=eq.${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, updated_at: new Date().toISOString() })
  });

  await fetchApi(`/assets?folder_id=eq.${folderId}`, { method: 'DELETE' });

  const allAssets = [
    ...videos.map(v => ({ folder_id: folderId, name: v.name, url: v.url, type: 'video' })),
    ...images.map(i => ({ folder_id: folderId, name: i.name, url: i.url, type: 'image' })),
  ];

  if (allAssets.length > 0) {
    await fetchApi('/assets', {
      method: 'POST',
      body: JSON.stringify(allAssets)
    });
  }

  return (await getFolderById(folderId))!;
}

export async function updateFolderAiDescription(folderId: string, aiDescription: string): Promise<void> {
  await fetchApi(`/folders?id=eq.${folderId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ai_description: aiDescription, updated_at: new Date().toISOString() })
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  await fetchApi(`/assets?folder_id=eq.${folderId}`, { method: 'DELETE' });
  await fetchApi(`/folders?id=eq.${folderId}`, { method: 'DELETE' });
}
