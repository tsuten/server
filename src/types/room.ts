import { BaseEntity, QueryOptions } from './base.js';

/**
 * ルームの種類（汎用的なメッセージコンテナ）
 */
export type RoomType = 'channel' | 'group' | 'forum' | 'general';

/**
 * ルームのステータス
 */
export type RoomStatus = 'active' | 'archived';

/**
 * ルームエンティティの定義
 * Discordのチャンネルのような汎用的なメッセージコンテナ
 */
export interface RoomEntity extends BaseEntity {
  name: string;
  description?: string;
  type: RoomType;
  status: RoomStatus;
  lastActivity?: Date;
  messageCount: number;
  isDefault?: boolean; // デフォルトルーム（generalなど）
}

/**
 * ルーム作成データの定義
 */
export interface RoomCreateData {
  name: string;
  description?: string;
  type?: RoomType;
  isDefault?: boolean;
}

/**
 * ルーム更新データの定義
 */
export interface RoomUpdateData {
  name?: string;
  description?: string;
  type?: RoomType;
  status?: RoomStatus;
  lastActivity?: Date;
  messageCount?: number;
  isDefault?: boolean;
}

/**
 * ルーム検索オプションの定義
 */
export interface RoomQueryOptions extends QueryOptions {
  name?: string;
  type?: RoomType;
  status?: RoomStatus;
  isDefault?: boolean;
}

/**
 * ルーム統計情報の定義
 */
export interface RoomStatistics {
  totalMessages: number;
  lastActivity: Date | null;
  messagesByType: Record<string, number>;
  uniqueUsers: number;
}
