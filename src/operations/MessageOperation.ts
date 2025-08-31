import { BaseOperation } from '../base/BaseOperation.js';
import { MessageModel } from '../models/MessageModel.js';
import { messageSchema } from '../schemas/MessageSchema.js';
import { messageRepository } from '../repositories/messageRepository.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';
import {
  MessageEntity,
  MessageCreateData,
  MessageUpdateData,
  MessageOperationInterface,
  MessageType,
  DateRangeQuery
} from '../types/message.js';
import { OperationResult, QueryOptions } from '../types/base.js';

/**
 * メッセージ操作クラス
 * 基盤クラスを継承し、Message固有の操作を実装
 */
export class MessageOperation 
  extends BaseOperation<MessageEntity, MessageCreateData, MessageUpdateData>
  implements MessageOperationInterface {

  protected logger = createLogger(LogCategory.OPERATION, 'MessageOperation');

  constructor() {
    super(MessageModel as any, messageSchema as any);
  }

  /**
   * 特定のルームのメッセージを取得
   */
  async findByRoom(room: string, options: QueryOptions = {}): Promise<OperationResult<MessageEntity[]>> {
    try {
      const { limit = 50, skip = 0 } = options;
      
      if (!room || typeof room !== 'string') {
        return this.createErrorResult('Room name is required and must be a string');
      }

      const result = await messageRepository.findByRoom(room.trim(), { limit, skip });
      if (!result.success) {
        return this.createErrorResult(result.error || 'Failed to get messages by room');
      }
      const messages = result.data;
      
      // 時系列順に並び替え（最新が最後）
      const sortedMessages = messages?.reverse() || [];
      
      return this.createSuccessResult(sortedMessages);
    } catch (error) {
      console.error('Error getting messages by room:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 特定のユーザーのメッセージを取得
   */
  async findByUser(username: string, options: QueryOptions = {}): Promise<OperationResult<MessageEntity[]>> {
    try {
      const { limit = 50, skip = 0 } = options;
      
      if (!username || typeof username !== 'string') {
        return this.createErrorResult('Username is required and must be a string');
      }

      const result = await messageRepository.findByUser(username.trim(), { limit, skip });
      if (!result.success) {
        return this.createErrorResult(result.error || 'Failed to get messages by user');
      }
      const messages = result.data;
      
      return this.createSuccessResult(messages || [] as any);
    } catch (error) {
      console.error('Error getting messages by user:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 日付範囲でメッセージを取得
   */
  async findByDateRange(query: DateRangeQuery): Promise<OperationResult<MessageEntity[]>> {
    try {
      const { startDate, endDate, room } = query;
      
      if (!startDate || !endDate) {
        return this.createErrorResult('Start date and end date are required');
      }

      if (startDate >= endDate) {
        return this.createErrorResult('Start date must be before end date');
      }

      const result = await messageRepository.findByDateRange({ startDate, endDate, room });
      if (!result.success) {
        return this.createErrorResult(result.error || 'Failed to get messages by date range');
      }
      const messages = result.data;
      
      return this.createSuccessResult(messages || []);
    } catch (error) {
      console.error('Error getting messages by date range:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * キーワードでメッセージを検索
   */
  async search(keyword: string, room?: string, limit: number = 50): Promise<OperationResult<MessageEntity[]>> {
    try {
      if (!keyword || typeof keyword !== 'string') {
        return this.createErrorResult('Search keyword is required and must be a string');
      }

      if (keyword.trim().length < 2) {
        return this.createErrorResult('Search keyword must be at least 2 characters long');
      }

      const result = await messageRepository.search(keyword.trim(), room, Math.min(limit, 100));
      if (!result.success) {
        return this.createErrorResult(result.error || 'Failed to search messages');
      }
      const messages = result.data;
      
      return this.createSuccessResult(messages || []);
    } catch (error) {
      console.error('Error searching messages:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 最新のメッセージを取得
   */
  async getLatest(limit: number = 50): Promise<OperationResult<MessageEntity[]>> {
    try {
      const messages = await this.model
        .find({})
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 100))
        .lean();

      // 時系列順に並び替え（最新が最後）
      const sortedMessages = messages.reverse();
      
      return this.createSuccessResult(sortedMessages as any);
    } catch (error) {
      console.error('Error getting latest messages:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * メッセージ数を取得
   */
  async getMessageCount(room?: string): Promise<OperationResult<number>> {
    try {
      const result = await messageRepository.getMessageCount(room);
      if (!result.success) {
        return this.createErrorResult(result.error || 'Failed to get message count');
      }
      const count = result.data;
      
      return this.createSuccessResult(count || 0);
    } catch (error) {
      console.error('Error getting message count:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 利用可能なメッセージタイプを取得
   */
  getMessageTypes(): MessageType[] {
    return messageSchema.getMessageTypes();
  }

  /**
   * メッセージの作成（オーバーライド）
   * 追加のビジネスロジックを含む
   */
  async create(data: MessageCreateData): Promise<OperationResult<MessageEntity>> {
    try {
      this.logger.debug('create called', data);
      
      // usernameが必須でない場合のデフォルト設定
      if (!data.username) {
        this.logger.warn('Username missing, returning error');
        return this.createErrorResult('Username is required for message creation');
      }

      // メッセージ固有のバリデーション
      if (data.message && data.message.trim().length === 0) {
        this.logger.warn('Empty message, returning error');
        return this.createErrorResult('Message content cannot be empty');
      }

      this.logger.debug('Calling super.create');
      
      // 基盤クラスのcreateメソッドを呼び出し
      const result = await super.create(data);
      
      this.logger.debug('super.create result', result);
      
      if (result.success && result.data) {
        this.logger.info('Message created successfully', {
          username: data.username,
          room: data.room || 'general',
          messageId: result.data._id
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error creating message', error, data);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 更新データのサニタイズ（オーバーライド）
   */
  protected sanitizeUpdateData(data: MessageUpdateData): Partial<MessageUpdateData> {
    const sanitized = super.sanitizeUpdateData(data);
    
    // メッセージの更新では、messageフィールドのみ許可
    if (sanitized.message !== undefined) {
      sanitized.message = sanitized.message?.trim();
      
      // 空メッセージの防止
      if (!sanitized.message || sanitized.message.length === 0) {
        delete sanitized.message;
      }
    }
    
    return sanitized;
  }

  /**
   * ルーム統計の取得（拡張機能）
   */
  async getRoomStatistics(room: string): Promise<OperationResult<{
    totalMessages: number;
    uniqueUsers: number;
    messagesByType: Record<MessageType, number>;
    lastActivity: Date | null;
  }>> {
    try {
      const [
        totalMessages,
        messages,
        lastMessage
      ] = await Promise.all([
        this.getMessageCount(room),
        this.model.find({ room: room.trim() }).lean(),
        this.model.findOne({ room: room.trim() }).sort({ timestamp: -1 }).lean()
      ]);

      if (!totalMessages.success) {
        return this.createErrorResult('Failed to get message count');
      }

      // ユニークユーザー数を計算
      const uniqueUsers = new Set(messages.map(m => m.username)).size;

      // タイプ別メッセージ数を計算
      const messagesByType: Record<MessageType, number> = {
        text: 0,
        system: 0,
        notification: 0
      };

      messages.forEach(message => {
        messagesByType[message.type as MessageType]++;
      });

      return this.createSuccessResult({
        totalMessages: totalMessages.data!,
        uniqueUsers,
        messagesByType,
        lastActivity: (lastMessage as any)?.timestamp || null
      });
    } catch (error) {
      console.error('Error getting room statistics:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }
}

// シングルトンインスタンス
export const messageOperation = new MessageOperation();

export default messageOperation;
