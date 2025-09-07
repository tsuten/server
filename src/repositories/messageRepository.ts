import { MessageModel, MessageDocument } from '../models/MessageModel.js';
import {
  MessageEntity,
  MessageCreateData,
  MessageUpdateData,
  MessageOperationInterface,
  MessageType,
  DateRangeQuery,
  MessageQueryOptions
} from '../types/message.js';
import { OperationResult, QueryOptions } from '../types/base.js';

/**
 * MessageRepository クラス
 * データベース操作を担当するRepository層
 */
export class MessageRepository implements MessageOperationInterface {

  /**
   * メッセージを作成
   */
  async create(data: MessageCreateData): Promise<OperationResult<MessageEntity>> {
    try {
      // バリデーション
      if (!data.message || data.message.trim().length === 0) {
        return this.createErrorResult('Message content is required');
      }
      
      if (!data.senderId || data.senderId.trim().length === 0) {
        return this.createErrorResult('SenderId is required');
      }

      if (!data.channelId || data.channelId.trim().length === 0) {
        return this.createErrorResult('ChannelId is required');
      }

      // デフォルト値の設定
      const messageData = {
        ...data,
        type: data.type || 'text' as MessageType
      };

      const message = new MessageModel(messageData);
      const savedMessage = await message.save();
      
      return this.createSuccessResult(savedMessage.toJSON());
    } catch (error) {
      console.error('Error creating message:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * IDでメッセージを取得
   */
  async findById(id: string): Promise<OperationResult<MessageEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Message ID is required');
      }

      const message = await MessageModel.findById(id).lean();
      
      if (!message) {
        return this.createErrorResult('Message not found');
      }

      return this.createSuccessResult(message as MessageEntity);
    } catch (error) {
      console.error('Error finding message by ID:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * メッセージを更新
   */
  async update(id: string, data: MessageUpdateData): Promise<OperationResult<MessageEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Message ID is required');
      }

      // メッセージ内容のバリデーション
      if (data.message !== undefined) {
        if (!data.message || data.message.trim().length === 0) {
          return this.createErrorResult('Message content cannot be empty');
        }
      }

      const updatedMessage = await MessageModel.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedMessage) {
        return this.createErrorResult('Message not found');
      }

      return this.createSuccessResult(updatedMessage as MessageEntity);
    } catch (error) {
      console.error('Error updating message:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * メッセージを削除
   */
  async delete(id: string): Promise<OperationResult<MessageEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Message ID is required');
      }

      const deletedMessage = await MessageModel.findByIdAndDelete(id).lean();

      if (!deletedMessage) {
        return this.createErrorResult('Message not found');
      }

      return this.createSuccessResult(deletedMessage as MessageEntity);
    } catch (error) {
      console.error('Error deleting message:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 複数のメッセージを取得
   */
  async findMany(query: Partial<MessageEntity> = {}, options: QueryOptions = {}): Promise<OperationResult<MessageEntity[]>> {
    try {
      const { limit = 50, skip = 0, sort = { timestamp: -1 } } = options;

      const messages = await MessageModel
        .find(query)
        .sort(sort)
        .limit(Math.min(limit, 100))
        .skip(skip)
        .lean();

      return this.createSuccessResult(messages as MessageEntity[]);
    } catch (error) {
      console.error('Error finding messages:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * メッセージ数をカウント
   */
  async count(query: Partial<MessageEntity> = {}): Promise<OperationResult<number>> {
    try {
      const count = await MessageModel.countDocuments(query);
      return this.createSuccessResult(count);
    } catch (error) {
      console.error('Error counting messages:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 特定のチャンネルのメッセージを取得
   */
  async findByChannel(channelId: string, options: QueryOptions = {}): Promise<OperationResult<MessageEntity[]>> {
    try {
      if (!channelId || typeof channelId !== 'string') {
        return this.createErrorResult('Channel ID is required and must be a string');
      }

      const { limit = 50, skip = 0 } = options;
      
      const messages = await MessageModel
        .find({ channelId: channelId.trim() })
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 100))
        .skip(skip)
        .lean();

      // 時系列順に並び替え（最新が最後）
      const sortedMessages = messages.reverse();
      
      return this.createSuccessResult(sortedMessages as MessageEntity[]);
    } catch (error) {
      console.error('Error getting messages by channel:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 特定の送信者のメッセージを取得
   */
  async findBySender(senderId: string, options: QueryOptions = {}): Promise<OperationResult<MessageEntity[]>> {
    try {
      if (!senderId || typeof senderId !== 'string') {
        return this.createErrorResult('Sender ID is required and must be a string');
      }

      const { limit = 50, skip = 0 } = options;
      
      const messages = await MessageModel
        .find({ senderId: senderId.trim() })
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 100))
        .skip(skip)
        .lean();
      
      return this.createSuccessResult(messages as MessageEntity[]);
    } catch (error) {
      console.error('Error getting messages by sender:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 日付範囲でメッセージを取得
   */
  async findByDateRange(query: DateRangeQuery): Promise<OperationResult<MessageEntity[]>> {
    try {
      const { startDate, endDate, channelId } = query;
      
      if (!startDate || !endDate) {
        return this.createErrorResult('Start date and end date are required');
      }

      if (startDate >= endDate) {
        return this.createErrorResult('Start date must be before end date');
      }

      const searchQuery: any = {
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      };

      if (channelId) {
        searchQuery.channelId = channelId.trim();
      }

      const messages = await MessageModel
        .find(searchQuery)
        .sort({ timestamp: 1 })
        .lean();
      
      return this.createSuccessResult(messages as MessageEntity[]);
    } catch (error) {
      console.error('Error getting messages by date range:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * キーワードでメッセージを検索
   */
  async search(keyword: string, channelId?: string, limit: number = 50): Promise<OperationResult<MessageEntity[]>> {
    try {
      if (!keyword || typeof keyword !== 'string') {
        return this.createErrorResult('Search keyword is required and must be a string');
      }

      if (keyword.trim().length < 2) {
        return this.createErrorResult('Search keyword must be at least 2 characters long');
      }

      const searchQuery: any = {
        message: { $regex: keyword.trim(), $options: 'i' }
      };

      if (channelId) {
        searchQuery.channelId = channelId.trim();
      }

      const messages = await MessageModel
        .find(searchQuery)
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 100))
        .lean();
      
      return this.createSuccessResult(messages as MessageEntity[]);
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
      const messages = await MessageModel
        .find({})
        .sort({ timestamp: -1 })
        .limit(Math.min(limit, 100))
        .lean();

      // 時系列順に並び替え（最新が最後）
      const sortedMessages = messages.reverse();
      
      return this.createSuccessResult(sortedMessages as MessageEntity[]);
    } catch (error) {
      console.error('Error getting latest messages:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * メッセージ数を取得
   */
  async getMessageCount(channelId?: string): Promise<OperationResult<number>> {
    try {
      const query = channelId ? { channelId: channelId.trim() } : {};
      const count = await MessageModel.countDocuments(query);
      
      return this.createSuccessResult(count);
    } catch (error) {
      console.error('Error getting message count:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 利用可能なメッセージタイプを取得
   */
  getMessageTypes(): MessageType[] {
    return ['text', 'system', 'notification'];
  }

  /**
   * バリデーション（基本実装）
   */
  validate(data: unknown): { isValid: boolean; errors: any[]; data: MessageCreateData | null } {
    try {
      const createData = data as MessageCreateData;
      const errors: any[] = [];

      if (!createData.message || typeof createData.message !== 'string' || createData.message.trim().length === 0) {
        errors.push({ field: 'message', message: 'Message content is required' });
      }

      if (!createData.senderId || typeof createData.senderId !== 'string' || createData.senderId.trim().length === 0) {
        errors.push({ field: 'senderId', message: 'SenderId is required' });
      }

      if (!createData.channelId || typeof createData.channelId !== 'string' || createData.channelId.trim().length === 0) {
        errors.push({ field: 'channelId', message: 'ChannelId is required' });
      }

      if (createData.message && createData.message.length > 1000) {
        errors.push({ field: 'message', message: 'Message content must be less than 1000 characters' });
      }

      if (createData.type && !['text', 'system', 'notification'].includes(createData.type)) {
        errors.push({ field: 'type', message: 'Invalid message type' });
      }

      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? createData : null
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'Invalid data format' }],
        data: null
      };
    }
  }

  /**
   * 成功結果を作成するヘルパーメソッド
   */
  private createSuccessResult<T>(data: T): OperationResult<T> {
    return {
      success: true,
      data
    };
  }

  /**
   * エラー結果を作成するヘルパーメソッド
   */
  private createErrorResult(error: string): OperationResult<any> {
    return {
      success: false,
      error
    };
  }
}

// シングルトンインスタンス
export const messageRepository = new MessageRepository();

export default messageRepository;
