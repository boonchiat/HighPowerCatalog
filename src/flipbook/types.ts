export interface BookPage {
  pageNumber: number;
  image: string;
  thumbnail: string;
  width: number;
  height: number;
}

export interface BookManifest {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  coverImage: string;
  pages: BookPage[];
}

export interface CacheState {
  isOfflineReady: boolean;
  isCaching: boolean;
  cacheProgress: number;
}
