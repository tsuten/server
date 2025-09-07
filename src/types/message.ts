import { BaseEntity, OperationResult, QueryOptions } from './base.js';
import { BaseOperationInterface } from './operation.js';

/**
 * メッセージタイプの定義
 */
export type MessageType = 'text' | 'system' | 'notification';

/**
 * メッセージエンティティの定義
 */
export interface MessageEntity extends BaseEntity {
  message: string;
  senderId: string;
  channelId: string;
}

/**
 * メッセージ作成データの定義
 */
export interface MessageCreateData {
  message: string;
  senderId: string;
  channelId: string;
  type?: MessageType;
}

/**
 * メッセージ更新データの定義
 */
export interface MessageUpdateData {
  message?: string;
  // senderIdやchannelIdは変更不可とする
}

/**
 * メッセージクエリオプションの定義
 */
export interface MessageQueryOptions extends QueryOptions {
  channelId?: string;
  senderId?: string;
  startDate?: Date;
  endDate?: Date;
  keyword?: string;
  type?: MessageType;
}

/**
 * 日付範囲クエリの定義
 */
export interface DateRangeQuery {
  startDate: Date;
  endDate: Date;
  channelId?: string;
}

/**
 * メッセージ操作インターフェース
 * 基本操作に加えて、Message固有の操作を定義
 */
export interface MessageOperationInterface extends BaseOperationInterface<
  MessageEntity,
  MessageCreateData,
  MessageUpdateData
> {
  // Message固有のクエリメソッド
  findByChannel(channelId: string, options?: QueryOptions): Promise<OperationResult<MessageEntity[]>>;
  findBySender(senderId: string, options?: QueryOptions): Promise<OperationResult<MessageEntity[]>>;
  findByDateRange(query: DateRangeQuery): Promise<OperationResult<MessageEntity[]>>;
  search(keyword: string, channelId?: string, limit?: number): Promise<OperationResult<MessageEntity[]>>;
  getLatest(limit?: number): Promise<OperationResult<MessageEntity[]>>;
  
  // 統計・集計メソッド
  getMessageCount(channelId?: string): Promise<OperationResult<number>>;
  getMessageTypes(): MessageType[];
}
