
import { BaseEntity, OperationResult, QueryOptions } from './base.js';
import { BaseOperationInterface } from './operation.js';

/**
 * ユーザータイプの定義
 */
export type UserType = 'admin' | 'moderator' | 'user' | 'guest';

/**
 * ユーザーエンティティの定義
 */
export interface UserEntity extends BaseEntity {
  authId: string; // 認証ID
  displayName: string; // ユーザー名
  email?: string; // メールアドレス
  avatar?: string; // アバター
  type: UserType; // ユーザータイプ
  settings?: UserSettings; // ユーザー固有の設定
  isOnline?: boolean; // オンライン状態
  lastSeen?: Date; // 最終アクセス時刻
}

/**
 * ユーザー設定の定義
 */
export interface UserSettings {
  private?: boolean;
  notifications?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
}

/**
 * ユーザー作成データの定義
 */
export interface UserCreateData {
  authId: string;
  displayName: string;
  email?: string;
  avatar?: string;
  type?: UserType;
  settings?: UserSettings;
}

/**
 * ユーザー更新データの定義
 */
export interface UserUpdateData {
  displayName?: string;
  email?: string;
  avatar?: string;
  type?: UserType;
  settings?: UserSettings;
  isOnline?: boolean;
  lastSeen?: Date;
}

/**
 * ユーザークエリオプションの定義
 */
export interface UserQueryOptions extends QueryOptions {
  email?: string;
  type?: UserType;
  private?: boolean;
  isOnline?: boolean;
}

/**
 * ユーザー操作インターフェース
 * 基本操作に加えて、User固有の操作を定義
 */
export interface UserOperationInterface extends BaseOperationInterface<
  UserEntity,
  UserCreateData,
  UserUpdateData
> {
  // User固有のクエリメソッド
  findByEmail(email: string, options?: QueryOptions): Promise<OperationResult<UserEntity[]>>;
  findByAuthId(authId: string): Promise<OperationResult<UserEntity>>;
  findByType(type: UserType, options?: QueryOptions): Promise<OperationResult<UserEntity[]>>;
  findOnlineUsers(options?: QueryOptions): Promise<OperationResult<UserEntity[]>>;
  searchUsers(keyword: string, options?: QueryOptions): Promise<OperationResult<UserEntity[]>>;
  
  // ユーザー管理メソッド
  updateOnlineStatus(userId: string, isOnline: boolean): Promise<OperationResult<UserEntity>>;
  updateLastSeen(userId: string): Promise<OperationResult<UserEntity>>;
  updateUserType(userId: string, type: UserType): Promise<OperationResult<UserEntity>>;
  updateUserSettings(userId: string, settings: UserSettings): Promise<OperationResult<UserEntity>>;
  
  // 統計・集計メソッド
  getUserCountByType(type?: UserType): Promise<OperationResult<number>>;
  getOnlineUserCount(): Promise<OperationResult<number>>;
  getUserTypes(): UserType[];
  getUserStatistics(): Promise<OperationResult<{
    totalUsers: number;
    onlineUsers: number;
    usersByType: Record<UserType, number>;
  }>>;
}
