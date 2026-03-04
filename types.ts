
export interface Asset {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video';
}

export interface Subfolder {
  id: string;
  folderId: string;
  name: string;
  videos: Asset[];
  images: Asset[];
  createdAt: number;
  notes?: string;
}

export interface Folder {
  id: string;
  name: string;
  subfolders: Subfolder[];
  subfolderCount: number;
  createdAt: number;
  aiDescription?: string;
  notes?: string;
}

export type ViewState = 'grid' | 'folder' | 'subfolder';

export interface Comment {
  id: string;
  subfolderId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
}
