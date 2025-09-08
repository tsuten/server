import { BaseEntity } from './base.js';

/**
 * Sender送信対象タイプの定義
 */
export type SendTargetType = 'user' | 'room' | 'broadcast' | 'users' | 'channel' | 'permission-based';

/**
 * 送信優先度の定義
 */
export enum SendPriority {
  LOW = 1,        // 低優先度（統計、レポートなど）
  NORMAL = 5,     // 通常優先度（一般的な通知）
  HIGH = 8,       // 高優先度（重要な通知）
  URGENT = 10     // 緊急（システム警告、セキュリティアラートなど）
}

/**
 * 送信イベントタイプの定義
 */
export interface SendEvent {
  type: string;
  category: 'notification' | 'update' | 'system' | 'realtime' | 'alert';
  data: any;
}

/**
 * 送信ジョブの詳細定義（BaseSenderから移動）
 */
export interface SendJob {
  id: string;
  type: SendTargetType;
  targets: string[];
  event: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt: Date;
  priority: SendPriority;
  metadata?: SendJobMetadata;
}

/**
 * 送信ジョブのメタデータ
 */
export interface SendJobMetadata {
  source: string;           // 送信元（どのSenderから）
  triggeredBy?: string;     // トリガーしたユーザーID
  relatedEntityId?: string; // 関連するエンティティID
  context?: Record<string, any>; // 追加のコンテキスト情報
}

/**
 * 送信結果の詳細定義
 */
export interface SendResult {
  success: boolean;
  jobId: string;
  error?: string;
  deliveredCount?: number;
  failedTargets?: string[];
  executionTime?: number;   // 実行時間（ミリ秒）
  retryCount?: number;      // リトライ回数
}

/**
 * Senderオプションの定義
 */
export interface SenderOptions {
  maxAttempts?: number;
  retryDelay?: number;
  queueProcessInterval?: number;
  maxConcurrentSends?: number;
  enableQueue?: boolean;
  enableBatching?: boolean; // バッチ送信の有効化
  batchSize?: number;       // バッチサイズ
  batchTimeout?: number;    // バッチタイムアウト（ミリ秒）
}

/**
 * 送信統計情報
 */
export interface SendStatistics {
  totalSent: number;
  successfulSends: number;
  failedSends: number;
  averageExecutionTime: number;
  queueLength: number;
  processingJobs: number;
  lastSentAt?: Date;
}

/**
 * 条件付き送信のフィルター
 */
export interface SendFilter {
  userTypes?: string[];     // ユーザータイプフィルター
  permissions?: string[];   // 権限フィルター
  channels?: string[];      // チャンネルフィルター
  rooms?: string[];         // ルームフィルター
  isOnline?: boolean;       // オンライン状態フィルター
  customFilter?: (target: any) => boolean; // カスタムフィルター関数
}

/**
 * バッチ送信リクエスト
 */
export interface BatchSendRequest {
  targets: string[];
  event: string;
  data: any;
  priority?: SendPriority;
  filter?: SendFilter;
  metadata?: SendJobMetadata;
}

/**
 * 送信テンプレートの定義
 */
export interface SendTemplate {
  id: string;
  name: string;
  event: string;
  dataTemplate: Record<string, any>;
  defaultPriority: SendPriority;
  description?: string;
}

/**
 * 遅延送信の設定
 */
export interface DelayedSendOptions {
  delay: number;            // 遅延時間（ミリ秒）
  scheduledAt?: Date;       // 特定の時刻に送信
  recurring?: RecurringOptions; // 繰り返し送信
}

/**
 * 繰り返し送信の設定
 */
export interface RecurringOptions {
  interval: number;         // 間隔（ミリ秒）
  maxOccurrences?: number; // 最大実行回数
  endAt?: Date;            // 終了日時
}

/**
 * BaseSenderインターフェース
 */
export interface BaseSenderInterface {
  // 基本送信メソッド
  sendToUser(userId: string, event: string, data: any, priority?: SendPriority): Promise<SendResult>;
  sendToRoom(roomId: string, event: string, data: any, priority?: SendPriority): Promise<SendResult>;
  sendToChannel(channelId: string, event: string, data: any, priority?: SendPriority): Promise<SendResult>;
  broadcast(event: string, data: any, priority?: SendPriority): Promise<SendResult>;
  sendToUsers(userIds: string[], event: string, data: any, priority?: SendPriority): Promise<SendResult>;
  
  // 高度な送信メソッド
  sendWithFilter(filter: SendFilter, event: string, data: any, priority?: SendPriority): Promise<SendResult>;
  sendBatch(requests: BatchSendRequest[]): Promise<SendResult[]>;
  sendDelayed(target: string, event: string, data: any, options: DelayedSendOptions): Promise<SendResult>;
  
  // テンプレート送信
  sendFromTemplate(templateId: string, target: string, data?: Record<string, any>): Promise<SendResult>;
  
  // 統計・管理
  getStatistics(): SendStatistics;
  clearQueue(): void;
  pauseQueue(): void;
  resumeQueue(): void;
}

/**
 * ドメイン固有のSenderインターフェース
 */

/**
 * MessageSender用のイベントタイプ
 */
export interface MessageSenderEvents {
  newMessage: { message: any; channelId: string; senderId: string };
  messageUpdated: { messageId: string; updatedData: any; updatedBy: string };
  messageDeleted: { messageId: string; channelId: string; deletedBy: string };
  channelJoined: { userId: string; channelId: string; timestamp: Date };
  channelLeft: { userId: string; channelId: string; timestamp: Date };
  typingStarted: { userId: string; channelId: string };
  typingStopped: { userId: string; channelId: string };
  mentionNotification: { mentionedUserId: string; messageId: string; senderId: string; channelId: string };
}

/**
 * UserSender用のイベントタイプ
 */
export interface UserSenderEvents {
  userOnline: { userId: string; user: any; timestamp: Date };
  userOffline: { userId: string; user: any; timestamp: Date };
  userProfileUpdated: { userId: string; updatedData: any; updatedBy: string };
  userStatusChanged: { userId: string; status: string; timestamp: Date };
  friendRequestSent: { fromUserId: string; toUserId: string; requestId: string };
  friendRequestAccepted: { fromUserId: string; toUserId: string; requestId: string };
  userBanned: { userId: string; bannedBy: string; reason?: string; expiresAt?: Date };
  userUnbanned: { userId: string; unbannedBy: string; timestamp: Date };
}

/**
 * ChannelSender用のイベントタイプ
 */
export interface ChannelSenderEvents {
  channelCreated: { channel: any; createdBy: string; roomId: string };
  channelUpdated: { channelId: string; updatedData: any; updatedBy: string };
  channelDeleted: { channelId: string; deletedBy: string; roomId: string };
  channelPermissionChanged: { channelId: string; permission: any; changedBy: string };
  userAddedToChannel: { userId: string; channelId: string; addedBy: string };
  userRemovedFromChannel: { userId: string; channelId: string; removedBy: string };
  channelMoved: { channelId: string; oldParentId?: string; newParentId?: string; movedBy: string };
}

/**
 * PermissionSender用のイベントタイプ
 */
export interface PermissionSenderEvents {
  permissionGranted: { userId: string; permission: any; grantedBy: string; resourceId?: string };
  permissionRevoked: { userId: string; permission: any; revokedBy: string; resourceId?: string };
  roleAssigned: { userId: string; roleId: string; assignedBy: string };
  roleRemoved: { userId: string; roleId: string; removedBy: string };
  roleCreated: { role: any; createdBy: string };
  roleUpdated: { roleId: string; updatedData: any; updatedBy: string };
  roleDeleted: { roleId: string; deletedBy: string };
  accessDenied: { userId: string; resource: string; action: string; timestamp: Date };
}

/**
 * ServerSender用のイベントタイプ（システム全体）
 */
export interface ServerSenderEvents {
  serverMaintenance: { message: string; startTime: Date; endTime?: Date; type: 'planned' | 'emergency' };
  serverUpdate: { version: string; features: string[]; updateTime: Date };
  systemAlert: { level: 'info' | 'warning' | 'error' | 'critical'; message: string; timestamp: Date };
  announcement: { title: string; content: string; publishedBy: string; expiresAt?: Date };
  resourceLimitWarning: { resource: string; currentUsage: number; limit: number; threshold: number };
}

/**
 * 通知タイプ別の設定
 */
export interface NotificationSettings {
  enabled: boolean;
  priority: SendPriority;
  channels: ('socket' | 'email' | 'push' | 'sms')[];
  throttle?: {
    maxPerMinute: number;
    maxPerHour: number;
  };
  conditions?: SendFilter;
}

/**
 * 全体的な通知設定
 */
export interface GlobalNotificationConfig {
  message: NotificationSettings;
  user: NotificationSettings;
  channel: NotificationSettings;
  permission: NotificationSettings;
  server: NotificationSettings;
}
