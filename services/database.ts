import { Folder, Subfolder, Asset } from '../types';
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

export interface DbSubfolder {
  id: string;
  folder_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAsset {
  id: string;
  folder_id: string;
  subfolder_id: string | null;
  name: string;
  url: string;
  type: 'image' | 'video';
  storage_path: string | null;
  created_at: string;
}

function toAppSubfolder(dbSubfolder: DbSubfolder, assets: DbAsset[]): Subfolder {
  return {
    id: dbSubfolder.id,
    folderId: dbSubfolder.folder_id,
    name: dbSubfolder.name,
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
    createdAt: new Date(dbSubfolder.created_at).getTime(),
    notes: dbSubfolder.notes || undefined,
  };
}

function toAppFolder(dbFolder: DbFolder, subfolderCount: number): Folder {
  return {
    id: dbFolder.id,
    name: dbFolder.name,
    subfolders: [],
    subfolderCount,
    createdAt: new Date(dbFolder.created_at).getTime(),
    aiDescription: dbFolder.ai_description || undefined,
    notes: dbFolder.notes || undefined,
  };
}

export async function getFolders(_userId?: string): Promise<Folder[]> {
  // Fetch folders
  const { data: folders, error: foldersError } = await supabase
    .from('folders')
    .select('*')
    .order('created_at', { ascending: false });

  if (foldersError) {
    console.error('Error fetching folders:', foldersError);
    throw foldersError;
  }

  if (!folders || folders.length === 0) {
    return [];
  }

  // Fetch subfolder counts for each folder
  const folderIds = folders.map((f: DbFolder) => f.id);
  const { data: subfolders, error: subfoldersError } = await supabase
    .from('subfolders')
    .select('id, folder_id')
    .in('folder_id', folderIds);

  if (subfoldersError) {
    console.error('Error fetching subfolders:', subfoldersError);
    throw subfoldersError;
  }

  // Count subfolders per folder
  const subfolderCountByFolder = (subfolders || []).reduce((acc: Record<string, number>, sf: { folder_id: string }) => {
    acc[sf.folder_id] = (acc[sf.folder_id] || 0) + 1;
    return acc;
  }, {});

  return folders.map((f: DbFolder) => toAppFolder(f, subfolderCountByFolder[f.id] || 0));
}

export async function createFolder(userId: string, name: string): Promise<Folder> {
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (folderError) {
    console.error('Error creating folder:', folderError);
    throw folderError;
  }

  return toAppFolder(folder, 0);
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

  // Get subfolder count
  const { count } = await supabase
    .from('subfolders')
    .select('*', { count: 'exact', head: true })
    .eq('folder_id', folderId);

  return toAppFolder(folder, count || 0);
}

export async function updateFolder(folderId: string, name: string): Promise<Folder> {
  const { error: updateError } = await supabase
    .from('folders')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', folderId);

  if (updateError) {
    console.error('Error updating folder:', updateError);
    throw updateError;
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
  // Cascade delete handles subfolders and assets automatically
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

// === Subfolder Functions ===

export async function getSubfolders(folderId: string): Promise<Subfolder[]> {
  const { data: subfolders, error: subfoldersError } = await supabase
    .from('subfolders')
    .select('*')
    .eq('folder_id', folderId)
    .order('created_at', { ascending: false });

  if (subfoldersError) {
    console.error('Error fetching subfolders:', subfoldersError);
    throw subfoldersError;
  }

  if (!subfolders || subfolders.length === 0) {
    return [];
  }

  // Fetch assets for all subfolders
  const subfolderIds = subfolders.map((sf: DbSubfolder) => sf.id);
  const { data: assets, error: assetsError } = await supabase
    .from('assets')
    .select('*')
    .in('subfolder_id', subfolderIds);

  if (assetsError) {
    console.error('Error fetching assets:', assetsError);
    throw assetsError;
  }

  // Group assets by subfolder
  const assetsBySubfolder = (assets || []).reduce((acc: Record<string, DbAsset[]>, asset: DbAsset) => {
    if (asset.subfolder_id) {
      if (!acc[asset.subfolder_id]) acc[asset.subfolder_id] = [];
      acc[asset.subfolder_id].push(asset);
    }
    return acc;
  }, {});

  return subfolders.map((sf: DbSubfolder) => toAppSubfolder(sf, assetsBySubfolder[sf.id] || []));
}

export async function getSubfolderById(subfolderId: string): Promise<Subfolder | null> {
  const { data: subfolder, error: subfolderError } = await supabase
    .from('subfolders')
    .select('*')
    .eq('id', subfolderId)
    .single();

  if (subfolderError || !subfolder) {
    return null;
  }

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('subfolder_id', subfolderId);

  return toAppSubfolder(subfolder, assets || []);
}

export async function createSubfolder(
  folderId: string,
  name: string,
  videos: Asset[],
  images: Asset[]
): Promise<Subfolder> {
  console.log('Creating subfolder:', { folderId, name, videoCount: videos.length, imageCount: images.length });

  const { data: subfolder, error: subfolderError } = await supabase
    .from('subfolders')
    .insert({ folder_id: folderId, name })
    .select()
    .single();

  if (subfolderError) {
    console.error('Error creating subfolder:', subfolderError);
    throw subfolderError;
  }

  console.log('Subfolder created:', subfolder.id);

  // Insert assets one at a time to avoid timeout with large base64 data
  for (const video of videos) {
    console.log('Inserting video:', video.name, 'size:', video.url.length);
    const { error } = await supabase
      .from('assets')
      .insert({
        folder_id: folderId,
        subfolder_id: subfolder.id,
        name: video.name,
        url: video.url,
        type: 'video'
      });
    if (error) {
      console.error('Error inserting video:', error);
      throw error;
    }
    console.log('Video inserted:', video.name);
  }

  for (const image of images) {
    console.log('Inserting image:', image.name, 'size:', image.url.length);
    const { error } = await supabase
      .from('assets')
      .insert({
        folder_id: folderId,
        subfolder_id: subfolder.id,
        name: image.name,
        url: image.url,
        type: 'image'
      });
    if (error) {
      console.error('Error inserting image:', error);
      throw error;
    }
    console.log('Image inserted:', image.name);
  }

  console.log('All assets inserted, fetching subfolder');
  return (await getSubfolderById(subfolder.id))!;
}

export async function updateSubfolder(
  subfolderId: string,
  name: string,
  videos: Asset[],
  images: Asset[]
): Promise<Subfolder> {
  console.log('Updating subfolder:', { subfolderId, name, videoCount: videos.length, imageCount: images.length });

  // Get the subfolder to find folder_id
  const { data: subfolder, error: getError } = await supabase
    .from('subfolders')
    .select('folder_id')
    .eq('id', subfolderId)
    .single();

  if (getError || !subfolder) {
    throw getError || new Error('Subfolder not found');
  }

  const { error: updateError } = await supabase
    .from('subfolders')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', subfolderId);

  if (updateError) {
    console.error('Error updating subfolder:', updateError);
    throw updateError;
  }

  // Delete existing assets
  console.log('Deleting existing assets');
  const { error: deleteError } = await supabase
    .from('assets')
    .delete()
    .eq('subfolder_id', subfolderId);

  if (deleteError) {
    console.error('Error deleting assets:', deleteError);
    throw deleteError;
  }

  // Insert assets one at a time to avoid timeout with large base64 data
  for (const video of videos) {
    console.log('Inserting video:', video.name, 'size:', video.url.length);
    const { error } = await supabase
      .from('assets')
      .insert({
        folder_id: subfolder.folder_id,
        subfolder_id: subfolderId,
        name: video.name,
        url: video.url,
        type: 'video'
      });
    if (error) {
      console.error('Error inserting video:', error);
      throw error;
    }
  }

  for (const image of images) {
    console.log('Inserting image:', image.name, 'size:', image.url.length);
    const { error } = await supabase
      .from('assets')
      .insert({
        folder_id: subfolder.folder_id,
        subfolder_id: subfolderId,
        name: image.name,
        url: image.url,
        type: 'image'
      });
    if (error) {
      console.error('Error inserting image:', error);
      throw error;
    }
  }

  console.log('Update complete');
  return (await getSubfolderById(subfolderId))!;
}

export async function deleteSubfolder(subfolderId: string): Promise<void> {
  // Cascade delete handles assets automatically
  const { error: subfolderError } = await supabase
    .from('subfolders')
    .delete()
    .eq('id', subfolderId);

  if (subfolderError) {
    console.error('Error deleting subfolder:', subfolderError);
    throw subfolderError;
  }
}

export async function updateSubfolderNotes(subfolderId: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('subfolders')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', subfolderId);

  if (error) {
    console.error('Error updating subfolder notes:', error);
    throw error;
  }
}
