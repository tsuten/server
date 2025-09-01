import { BaseOperation } from '../base/BaseOperation.js';
import { ChannelModel } from '../models/ChannelModel.js';
import { channelRepository } from '../repositories/channelRepository.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';
import {
  ChannelEntity,
  ChannelCreateData,
  ChannelUpdateData,
  ChannelQueryOptions,
  ChannelType,
  ChannelOperationInterface
} from '../types/channel.js';
import { OperationResult, ValidationResult, QueryOptions } from '../types/base.js';

/**
 * チャンネル操作クラス
 * BaseOperationを継承し、チャンネル固有の操作を実装
 */
export class ChannelOperation 
  extends BaseOperation<ChannelEntity, ChannelCreateData, ChannelUpdateData>
  implements ChannelOperationInterface {

  protected logger = createLogger(LogCategory.OPERATION, 'ChannelOperation');

  constructor() {
    super(ChannelModel as any, null as any); // スキーマはRepository層で処理
  }

  /**
   * チャンネル作成（オーバーライド）
   */
  async create(data: ChannelCreateData): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('create called', { name: data.name, room: data.room, type: data.type });
      
      // Repository層での作成処理
      const result = await channelRepository.create(data);
      
      if (result.success && result.data) {
        this.logger.info('Channel created successfully', {
          channelId: result.data._id,
          name: data.name,
          room: data.room,
          type: data.type
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error creating channel', error, { name: data.name, room: data.room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネル更新（オーバーライド）
   */
  async update(id: string, data: ChannelUpdateData): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('update called', { channelId: id });
      
      // Repository層での更新処理
      const result = await channelRepository.update(id, data);
      
      if (result.success && result.data) {
        this.logger.info('Channel updated successfully', {
          channelId: id,
          updatedFields: Object.keys(data)
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error updating channel', error, { channelId: id });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネル削除（オーバーライド）
   */
  async delete(id: string): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('delete called', { channelId: id });
      
      // Repository層での削除処理
      const result = await channelRepository.delete(id);
      
      if (result.success && result.data) {
        this.logger.info('Channel deleted successfully', {
          channelId: id,
          name: result.data.name
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error deleting channel', error, { channelId: id });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * IDでチャンネルを取得（オーバーライド）
   */
  async findById(id: string): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('findById called', { channelId: id });
      
      if (!id) {
        return {
          success: false,
          error: 'チャンネルIDは必須です'
        };
      }

      const result = await channelRepository.findById(id);
      return result;
    } catch (error) {
      this.logger.error('Error finding channel by ID', error, { channelId: id });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * ルーム別でチャンネルを取得
   */
  async findByRoom(room: string, options?: QueryOptions): Promise<OperationResult<ChannelEntity[]>> {
    try {
      this.logger.debug('findByRoom called', { room });
      
      if (!room) {
        return {
          success: false,
          error: 'ルームは必須です'
        };
      }

      const result = await channelRepository.findByRoom(room, options);
      return result;
    } catch (error) {
      this.logger.error('Error finding channels by room', error, { room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * タイプ別でチャンネルを取得
   */
  async findByType(type: ChannelType, room?: string): Promise<OperationResult<ChannelEntity[]>> {
    try {
      this.logger.debug('findByType called', { type, room });
      
      if (!type) {
        return {
          success: false,
          error: 'チャンネルタイプは必須です'
        };
      }

      const result = await channelRepository.findByType(type, room);
      return result;
    } catch (error) {
      this.logger.error('Error finding channels by type', error, { type, room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * 親チャンネル別でチャンネルを取得
   */
  async findByParent(parentId: string): Promise<OperationResult<ChannelEntity[]>> {
    try {
      this.logger.debug('findByParent called', { parentId });
      
      if (!parentId) {
        return {
          success: false,
          error: '親チャンネルIDは必須です'
        };
      }

      const result = await channelRepository.findByParent(parentId);
      return result;
    } catch (error) {
      this.logger.error('Error finding channels by parent', error, { parentId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * ユーザーがアクセス可能なチャンネルを取得
   */
  async findAccessibleByUser(userId: string, room?: string): Promise<OperationResult<ChannelEntity[]>> {
    try {
      this.logger.debug('findAccessibleByUser called', { userId, room });
      
      if (!userId) {
        return {
          success: false,
          error: 'ユーザーIDは必須です'
        };
      }

      const result = await channelRepository.findAccessibleByUser(userId, room);
      return result;
    } catch (error) {
      this.logger.error('Error finding accessible channels', error, { userId, room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネル階層を取得
   */
  async getChannelHierarchy(room: string): Promise<OperationResult<ChannelEntity[]>> {
    try {
      this.logger.debug('getChannelHierarchy called', { room });
      
      if (!room) {
        return {
          success: false,
          error: 'ルームは必須です'
        };
      }

      const result = await channelRepository.getChannelHierarchy(room);
      return result;
    } catch (error) {
      this.logger.error('Error getting channel hierarchy', error, { room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネルの位置を更新
   */
  async updatePosition(channelId: string, position: number): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('updatePosition called', { channelId, position });
      
      if (!channelId) {
        return {
          success: false,
          error: 'チャンネルIDは必須です'
        };
      }

      if (position < 0) {
        return {
          success: false,
          error: '位置は0以上である必要があります'
        };
      }

      const result = await channelRepository.updatePosition(channelId, position);
      
      if (result.success) {
        this.logger.info('Channel position updated', { channelId, position });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error updating channel position', error, { channelId, position });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネルをカテゴリに移動
   */
  async moveToCategory(channelId: string, categoryId?: string): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('moveToCategory called', { channelId, categoryId });
      
      if (!channelId) {
        return {
          success: false,
          error: 'チャンネルIDは必須です'
        };
      }

      const result = await channelRepository.moveToCategory(channelId, categoryId);
      
      if (result.success) {
        this.logger.info('Channel moved to category', { channelId, categoryId });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error moving channel to category', error, { channelId, categoryId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * ユーザーアクセスを追加
   */
  async addUserAccess(channelId: string, userId: string): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('addUserAccess called', { channelId, userId });
      
      if (!channelId || !userId) {
        return {
          success: false,
          error: 'チャンネルIDとユーザーIDは必須です'
        };
      }

      const result = await channelRepository.addUserAccess(channelId, userId);
      
      if (result.success) {
        this.logger.info('User access added to channel', { channelId, userId });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error adding user access', error, { channelId, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * ユーザーアクセスを削除
   */
  async removeUserAccess(channelId: string, userId: string): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('removeUserAccess called', { channelId, userId });
      
      if (!channelId || !userId) {
        return {
          success: false,
          error: 'チャンネルIDとユーザーIDは必須です'
        };
      }

      const result = await channelRepository.removeUserAccess(channelId, userId);
      
      if (result.success) {
        this.logger.info('User access removed from channel', { channelId, userId });
      }
      
      return result;
    } catch (error) {
      this.logger.error('Error removing user access', error, { channelId, userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネル数を取得
   */
  async getChannelCount(room?: string): Promise<OperationResult<number>> {
    try {
      this.logger.debug('getChannelCount called', { room });
      
      const result = await channelRepository.getChannelCount(room);
      return result;
    } catch (error) {
      this.logger.error('Error getting channel count', error, { room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネルタイプ一覧を取得
   */
  getChannelTypes(): ChannelType[] {
    return channelRepository.getChannelTypes();
  }

  /**
   * チャンネル名で検索
   */
  async findByName(name: string, room?: string): Promise<OperationResult<ChannelEntity>> {
    try {
      this.logger.debug('findByName called', { name, room });
      
      if (!name) {
        return {
          success: false,
          error: 'チャンネル名は必須です'
        };
      }

      const query: any = { name: name.trim() };
      if (room) {
        query.room = room;
      }

      const channel = await ChannelModel.findOne(query).lean();
      
      if (!channel) {
        return {
          success: false,
          error: 'チャンネルが見つかりません'
        };
      }

      return {
        success: true,
        data: channel as ChannelEntity
      };
    } catch (error) {
      this.logger.error('Error finding channel by name', error, { name, room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネル検索（キーワード）
   */
  async searchChannels(keyword: string, room?: string, limit: number = 20): Promise<OperationResult<ChannelEntity[]>> {
    try {
      this.logger.debug('searchChannels called', { keyword, room, limit });
      
      if (!keyword || keyword.trim().length === 0) {
        return {
          success: false,
          error: '検索キーワードは必須です'
        };
      }

      const query: any = {
        $or: [
          { name: { $regex: keyword.trim(), $options: 'i' } },
          { description: { $regex: keyword.trim(), $options: 'i' } }
        ]
      };

      if (room) {
        query.room = room;
      }

      const channels = await ChannelModel.find(query)
        .sort({ position: 1 })
        .limit(limit)
        .lean();

      return {
        success: true,
        data: channels as ChannelEntity[]
      };
    } catch (error) {
      this.logger.error('Error searching channels', error, { keyword, room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * チャンネル統計の取得
   */
  async getChannelStatistics(room?: string): Promise<OperationResult<{
    totalChannels: number;
    channelsByType: Record<ChannelType, number>;
    privateChannels: number;
    publicChannels: number;
  }>> {
    try {
      this.logger.debug('getChannelStatistics called', { room });
      
      const query: any = {};
      if (room) {
        query.room = room;
      }

      // 総チャンネル数
      const totalResult = await this.getChannelCount(room);
      if (!totalResult.success) {
        return {
          success: false,
          error: 'Failed to get total channel count'
        };
      }

      // タイプ別チャンネル数
      const channelsByType: Record<ChannelType, number> = {} as Record<ChannelType, number>;
      for (const type of this.getChannelTypes()) {
        const typeResult = await this.findByType(type, room);
        channelsByType[type] = typeResult.success ? typeResult.data!.length : 0;
      }

      // プライベート/パブリックチャンネル数
      const privateChannels = await ChannelModel.countDocuments({ ...query, isPrivate: true });
      const publicChannels = await ChannelModel.countDocuments({ ...query, isPrivate: false });

      return {
        success: true,
        data: {
          totalChannels: totalResult.data!,
          channelsByType,
          privateChannels,
          publicChannels
        }
      };
    } catch (error) {
      this.logger.error('Error getting channel statistics', error, { room });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * バリデーション（Repository層に委譲）
   */
  validate(data: unknown): ValidationResult<ChannelCreateData> {
    return channelRepository.validate(data);
  }
}

// シングルトンインスタンス
export const channelOperation = new ChannelOperation();

export default channelOperation;
