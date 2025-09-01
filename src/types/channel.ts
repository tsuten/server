import { BaseEntity, OperationResult, QueryOptions } from './base.js';
import { BaseOperationInterface } from './operation.js';

/**
 * チャンネルタイプの定義
 */
export enum ChannelType {
  TEXT = 'text',           // テキストチャンネル
  VOICE = 'voice',         // ボイスチャンネル
  CATEGORY = 'category',   // カテゴリチャンネル
  PRIVATE = 'private'      // プライベートチャンネル
}

/**
 * チャンネルエンティティの定義
 */
export interface ChannelEntity extends BaseEntity {
  name: string;                    // チャンネル名
  type: ChannelType;              // チャンネルタイプ
  description?: string;           // チャンネル説明
  room: string;                   // 所属するルームID
  parentId?: string;              // 親チャンネルID（カテゴリの場合）
  position: number;               // 表示順序
  isPrivate: boolean;             // プライベートチャンネルかどうか
  allowedUsers?: string[];        // アクセス許可されたユーザーIDリスト（プライベートチャンネルの場合）
  settings?: ChannelSettings;     // チャンネル固有の設定
}

/**
 * チャンネル設定の定義
 */
export interface ChannelSettings {
  slowMode?: number;              // スローモード（秒）
  maxUsers?: number;              // 最大ユーザー数（ボイスチャンネルの場合）
  autoDelete?: boolean;           // 自動削除設定
  autoDeleteAfter?: number;       // 自動削除までの時間（分）
  allowFileUpload?: boolean;      // ファイルアップロード許可
  maxFileSize?: number;           // 最大ファイルサイズ（MB）
}

/**
 * チャンネル作成データの定義
 */
export interface ChannelCreateData {
  name: string;
  type: ChannelType;
  description?: string;
  room: string;
  parentId?: string;
  position?: number;
  isPrivate?: boolean;
  allowedUsers?: string[];
  settings?: ChannelSettings;
}

/**
 * チャンネル更新データの定義
 */
export interface ChannelUpdateData {
  name?: string;
  description?: string;
  position?: number;
  isPrivate?: boolean;
  allowedUsers?: string[];
  settings?: ChannelSettings;
}

/**
 * チャンネルクエリオプションの定義
 */
export interface ChannelQueryOptions extends QueryOptions {
  room?: string;
  type?: ChannelType;
  parentId?: string;
  isPrivate?: boolean;
  userId?: string;                // ユーザーがアクセス可能なチャンネルを検索
}

/**
 * チャンネル操作インターフェース
 * 基本操作に加えて、Channel固有の操作を定義
 */
export interface ChannelOperationInterface extends BaseOperationInterface<
  ChannelEntity,
  ChannelCreateData,
  ChannelUpdateData
> {
  // Channel固有のクエリメソッド
  findByRoom(room: string, options?: QueryOptions): Promise<OperationResult<ChannelEntity[]>>;
  findByType(type: ChannelType, room?: string): Promise<OperationResult<ChannelEntity[]>>;
  findByParent(parentId: string): Promise<OperationResult<ChannelEntity[]>>;
  findAccessibleByUser(userId: string, room?: string): Promise<OperationResult<ChannelEntity[]>>;
  getChannelHierarchy(room: string): Promise<OperationResult<ChannelEntity[]>>;
  
  // チャンネル管理メソッド
  updatePosition(channelId: string, position: number): Promise<OperationResult<ChannelEntity>>;
  moveToCategory(channelId: string, categoryId?: string): Promise<OperationResult<ChannelEntity>>;
  addUserAccess(channelId: string, userId: string): Promise<OperationResult<ChannelEntity>>;
  removeUserAccess(channelId: string, userId: string): Promise<OperationResult<ChannelEntity>>;
  
  // 統計・集計メソッド
  getChannelCount(room?: string): Promise<OperationResult<number>>;
  getChannelTypes(): ChannelType[];
}
