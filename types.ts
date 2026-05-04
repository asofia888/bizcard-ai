export interface BusinessCard {
  id: string;
  name: string;
  title: string;
  company: string;
  country: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  note: string;
  tags: string[];
  imageUri: string | null;     // 表面 Base64 or URL（フル解像度）
  imageUriBack: string | null; // 裏面 Base64 or URL（フル解像度）
  thumbUri: string | null;     // 表面のサムネ（200px JPEG）。リスト描画用
  createdAt: number;
}

export type ViewState = 'LIST' | 'CAMERA' | 'ADJUST' | 'EDIT' | 'DETAIL' | 'SETTINGS';

export enum ExtractionStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}