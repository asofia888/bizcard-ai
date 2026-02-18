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
  note: string; // Added note field
  tags: string[];
  imageUri: string | null; // Base64 or URL
  createdAt: number;
}

export type ViewState = 'LIST' | 'CAMERA' | 'EDIT' | 'DETAIL' | 'SETTINGS';

export enum ExtractionStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}