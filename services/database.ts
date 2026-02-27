import { Folder, Asset } from '../types';
import { supabase } from './supabase';

export interface DbFolder {
  id: string;
  user_id: string;
  name: string;
  ai_description: string | null;
  notes: string | null;
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
    notes: dbFolder.notes || undefined,
  };
}

export async function getFolders(userId: string): Promise<Folder[]> {
  const { data: folders, error: foldersError } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (foldersError) {
    console.error('Error fetching folders:', foldersError);
    throw foldersError;
  }

  if (!folders || folders.length === 0) {
    return [];
  }

  const folderIds = folders.map((f: DbFolder) => f.id);
  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('*')
    .in('folder_id', folderIds);

  if (assetsError) {
    console.error('Error fetching assets:', assetsError);
    throw assetsError;
  }

  const assetsByFolder = (assets || []).reduce((acc: Record<string, DbAsset[]>, asset: DbAsset) => {
    if (!acc[asset.folder_id]) acc[asset.folder_id] = [];
    acc[asset.folder_id].push(asset);
    return acc;
  }, {});

  return folders.map((f: DbFolder) => toAppFolder(f, assetsByFolder[f.id] || []));
}

export async function createFolder(
  userId: string,
  name: string,
  videos: Asset[],
  images: Asset[]
): Promise<Folder> {
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (folderError) {
    console.error('Error creating folder:', folderError);
    throw folderError;
  }

  const allAssets = [
    ...videos.map(v => ({ folder_id: folder.id, name: v.name, url: v.url, type: 'video' })),
    ...images.map(i => ({ folder_id: folder.id, name: i.name, url: i.url, type: 'image' })),
  ];

  if (allAssets.length > 0) {
    const { error: assetsError } = await supabase
      .from('assets')
      .insert(allAssets);

    if (assetsError) {
      console.error('Error creating assets:', assetsError);
      throw assetsError;
    }
  }

  return (await getFolderById(folder.id))!;
}

export async function getFolderById(folderId: string): Promise<Folder | null> {
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('*')
    .eq('id', folderId)
    .single();

  if (folderError || !folder) {
    return null;
  }

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('folder_id', folderId);

  return toAppFolder(folder, assets || []);
}

export async function updateFolder(
  folderId: string,
  name: string,
  videos: Asset[],
  images: Asset[]
): Promise<Folder> {
  const { error: updateError } = await supabase
    .from('folders')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', folderId);

  if (updateError) {
    console.error('Error updating folder:', updateError);
    throw updateError;
  }

  // Delete existing assets
  const { error: deleteError } = await supabase
    .from('assets')
    .delete()
    .eq('folder_id', folderId);

  if (deleteError) {
    console.error('Error deleting assets:', deleteError);
    throw deleteError;
  }

  // Insert new assets
  const allAssets = [
    ...videos.map(v => ({ folder_id: folderId, name: v.name, url: v.url, type: 'video' })),
    ...images.map(i => ({ folder_id: folderId, name: i.name, url: i.url, type: 'image' })),
  ];

  if (allAssets.length > 0) {
    const { error: insertError } = await supabase
      .from('assets')
      .insert(allAssets);

    if (insertError) {
      console.error('Error inserting assets:', insertError);
      throw insertError;
    }
  }

  return (await getFolderById(folderId))!;
}

export async function updateFolderAiDescription(folderId: string, aiDescription: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ ai_description: aiDescription, updated_at: new Date().toISOString() })
    .eq('id', folderId);

  if (error) {
    console.error('Error updating AI description:', error);
    throw error;
  }
}

export async function deleteFolder(folderId: string): Promise<void> {
  // Delete assets first
  const { error: assetsError } = await supabase
    .from('assets')
    .delete()
    .eq('folder_id', folderId);

  if (assetsError) {
    console.error('Error deleting assets:', assetsError);
    throw assetsError;
  }

  // Delete folder
  const { error: folderError } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);

  if (folderError) {
    console.error('Error deleting folder:', folderError);
    throw folderError;
  }
}

export async function updateFolderNotes(folderId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', folderId);

  if (error) {
    console.error('Error updating notes:', error);
    throw error;
  }
}
