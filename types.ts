
export interface Asset {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video';
}

export interface Folder {
  id: string;
  name: string;
  videos: Asset[]; // Changed from single video to array
  images: Asset[];
  createdAt: number;
  aiDescription?: string;
}

export type ViewState = 'grid' | 'viewing';
