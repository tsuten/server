import { BaseEntity } from './base.js';

export interface ServerSettings {
  is_private: boolean;
  max_members: number;
}

export interface ServerEntity extends BaseEntity {
  name: string;
  slug?: string;
  description: string;
  logo?: string;
  language?: string;
  categories?: string[];
  settings?: ServerSettings;
}

export interface ServerCreateData {
  name: string;
  description: string;
  logo?: string;
  language?: string;
  categories?: string[];
  settings?: ServerSettings;
}