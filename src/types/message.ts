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
  username: string;
  room: string;
  type: MessageType;
}

/**
 * メッセージ作成データの定義
 */
export interface MessageCreateData {
  message: string;
  username: string;
  room?: string;
  type?: MessageType;
}

/**
 * メッセージ更新データの定義
 */
export interface MessageUpdateData {
  message?: string;
  // usernameやroomは変更不可とする
}

/**
 * メッセージクエリオプションの定義
 */
export interface MessageQueryOptions extends QueryOptions {
  room?: string;
  username?: string;
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
  room?: string;
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
  findByRoom(room: string, options?: QueryOptions): Promise<OperationResult<MessageEntity[]>>;
  findByUser(username: string, options?: QueryOptions): Promise<OperationResult<MessageEntity[]>>;
  findByDateRange(query: DateRangeQuery): Promise<OperationResult<MessageEntity[]>>;
  search(keyword: string, room?: string, limit?: number): Promise<OperationResult<MessageEntity[]>>;
  getLatest(limit?: number): Promise<OperationResult<MessageEntity[]>>;
  
  // 統計・集計メソッド
  getMessageCount(room?: string): Promise<OperationResult<number>>;
  getMessageTypes(): MessageType[];
}
