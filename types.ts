
export interface Asset {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video';
}

export interface Folder {
  id: string;
  name: string;
  videos: Asset[];
  images: Asset[];
  createdAt: number;
  aiDescription?: string;
  notes?: string;
}

export type ViewState = 'grid' | 'viewing';
