import { ChannelModel, ChannelDocument } from '../models/ChannelModel.js';
import {
  ChannelEntity,
  ChannelCreateData,
  ChannelUpdateData,
  ChannelQueryOptions,
  ChannelType,
  ChannelOperationInterface
} from '../types/channel.js';
import { OperationResult, ValidationResult, ValidationError, QueryOptions } from '../types/base.js';

/**
 * ChannelRepository クラス
 * チャンネル関連のデータベース操作を担当するRepository層
 */
export class ChannelRepository implements ChannelOperationInterface {

  /**
   * チャンネルを作成
   */
  async create(data: ChannelCreateData): Promise<OperationResult<ChannelEntity>> {
    try {
      // バリデーション
      const validation = this.validate(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // チャンネル名の重複チェック（同じルーム内で）
      const existingChannel = await this.findByNameAndRoom(data.name, data.room);
      if (existingChannel.success) {
        return this.createErrorResult('Channel name already exists in this room');
      }

      // 位置が指定されていない場合は、最後の位置を取得して+1
      if (data.position === undefined) {
        const lastPositionResult = await this.getLastPosition(data.room, data.parentId);
        data.position = lastPositionResult.success ? lastPositionResult.data! + 1 : 0;
      }

      const channel = new ChannelModel(data);
      const savedChannel = await channel.save();
      
      return this.createSuccessResult(savedChannel.toJSON());
    } catch (error) {
      console.error('Error creating channel:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * IDでチャンネルを取得
   */
  async findById(id: string): Promise<OperationResult<ChannelEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Channel ID is required');
      }

      const channel = await ChannelModel.findById(id).lean();
      
      if (!channel) {
        return this.createErrorResult('Channel not found');
      }

      return this.createSuccessResult(channel as ChannelEntity);
    } catch (error) {
      console.error('Error finding channel by ID:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネルを更新
   */
  async update(id: string, data: ChannelUpdateData): Promise<OperationResult<ChannelEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Channel ID is required');
      }

      // チャンネル名の重複チェック（自分以外のチャンネルで同じ名前がないか）
      if (data.name) {
        const existingChannel = await ChannelModel.findOne({ 
          name: data.name.trim(),
          _id: { $ne: id }
        }).lean();
        
        if (existingChannel) {
          return this.createErrorResult('Channel name already exists');
        }
      }

      const updatedChannel = await ChannelModel.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedChannel) {
        return this.createErrorResult('Channel not found');
      }

      return this.createSuccessResult(updatedChannel as ChannelEntity);
    } catch (error) {
      console.error('Error updating channel:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネルを削除
   */
  async delete(id: string): Promise<OperationResult<ChannelEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Channel ID is required');
      }

      const deletedChannel = await ChannelModel.findByIdAndDelete(id).lean();

      if (!deletedChannel) {
        return this.createErrorResult('Channel not found');
      }

      return this.createSuccessResult(deletedChannel as ChannelEntity);
    } catch (error) {
      console.error('Error deleting channel:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ルーム別でチャンネルを取得
   */
  async findByRoom(room: string, options?: QueryOptions): Promise<OperationResult<ChannelEntity[]>> {
    try {
      if (!room) {
        return this.createErrorResult('Room is required');
      }

      const query: any = { room };
      const limit = options?.limit || 50;
      const skip = options?.skip || 0;
      const sort = options?.sort || { position: 1 };

      const channels = await ChannelModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      return this.createSuccessResult(channels as ChannelEntity[]);
    } catch (error) {
      console.error('Error finding channels by room:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * タイプ別でチャンネルを取得
   */
  async findByType(type: ChannelType, room?: string): Promise<OperationResult<ChannelEntity[]>> {
    try {
      if (!type) {
        return this.createErrorResult('Channel type is required');
      }

      const query: any = { type };
      if (room) {
        query.room = room;
      }

      const channels = await ChannelModel.find(query)
        .sort({ position: 1 })
        .lean();

      return this.createSuccessResult(channels as ChannelEntity[]);
    } catch (error) {
      console.error('Error finding channels by type:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 親チャンネル別でチャンネルを取得
   */
  async findByParent(parentId: string): Promise<OperationResult<ChannelEntity[]>> {
    try {
      if (!parentId) {
        return this.createErrorResult('Parent ID is required');
      }

      const channels = await ChannelModel.find({ parentId })
        .sort({ position: 1 })
        .lean();

      return this.createSuccessResult(channels as ChannelEntity[]);
    } catch (error) {
      console.error('Error finding channels by parent:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーがアクセス可能なチャンネルを取得
   */
  async findAccessibleByUser(userId: string, room?: string): Promise<OperationResult<ChannelEntity[]>> {
    try {
      if (!userId) {
        return this.createErrorResult('User ID is required');
      }

      const query: any = {
        $or: [
          { isPrivate: false }, // パブリックチャンネル
          { allowedUsers: userId } // ユーザーがアクセス許可されているプライベートチャンネル
        ]
      };

      if (room) {
        query.room = room;
      }

      const channels = await ChannelModel.find(query)
        .sort({ position: 1 })
        .lean();

      return this.createSuccessResult(channels as ChannelEntity[]);
    } catch (error) {
      console.error('Error finding accessible channels:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネル階層を取得
   */
  async getChannelHierarchy(room: string): Promise<OperationResult<ChannelEntity[]>> {
    try {
      if (!room) {
        return this.createErrorResult('Room is required');
      }

      // カテゴリチャンネルを先に取得
      const categories = await ChannelModel.find({ 
        room, 
        type: ChannelType.CATEGORY 
      }).sort({ position: 1 }).lean();

      // その他のチャンネルを取得
      const otherChannels = await ChannelModel.find({ 
        room, 
        type: { $ne: ChannelType.CATEGORY } 
      }).sort({ position: 1 }).lean();

      // 階層構造を作成
      const hierarchy: ChannelEntity[] = [];
      
      // カテゴリとその子チャンネルを追加
      for (const category of categories) {
        hierarchy.push(category as ChannelEntity);
        const childChannels = otherChannels.filter(ch => ch.parentId === category._id);
        hierarchy.push(...childChannels as ChannelEntity[]);
      }

      // 親のないチャンネルを追加
      const orphanChannels = otherChannels.filter(ch => !ch.parentId);
      hierarchy.push(...orphanChannels as ChannelEntity[]);

      return this.createSuccessResult(hierarchy);
    } catch (error) {
      console.error('Error getting channel hierarchy:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネルの位置を更新
   */
  async updatePosition(channelId: string, position: number): Promise<OperationResult<ChannelEntity>> {
    try {
      if (!channelId) {
        return this.createErrorResult('Channel ID is required');
      }

      if (position < 0) {
        return this.createErrorResult('Position must be non-negative');
      }

      const updatedChannel = await ChannelModel.findByIdAndUpdate(
        channelId,
        { $set: { position } },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedChannel) {
        return this.createErrorResult('Channel not found');
      }

      return this.createSuccessResult(updatedChannel as ChannelEntity);
    } catch (error) {
      console.error('Error updating channel position:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネルをカテゴリに移動
   */
  async moveToCategory(channelId: string, categoryId?: string): Promise<OperationResult<ChannelEntity>> {
    try {
      if (!channelId) {
        return this.createErrorResult('Channel ID is required');
      }

      // カテゴリIDが指定されている場合は、そのカテゴリが存在するかチェック
      if (categoryId) {
        const categoryResult = await this.findById(categoryId);
        if (!categoryResult.success) {
          return this.createErrorResult('Category not found');
        }
        if (categoryResult.data!.type !== ChannelType.CATEGORY) {
          return this.createErrorResult('Specified channel is not a category');
        }
      }

      const updatedChannel = await ChannelModel.findByIdAndUpdate(
        channelId,
        { $set: { parentId: categoryId } },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedChannel) {
        return this.createErrorResult('Channel not found');
      }

      return this.createSuccessResult(updatedChannel as ChannelEntity);
    } catch (error) {
      console.error('Error moving channel to category:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーアクセスを追加
   */
  async addUserAccess(channelId: string, userId: string): Promise<OperationResult<ChannelEntity>> {
    try {
      if (!channelId || !userId) {
        return this.createErrorResult('Channel ID and User ID are required');
      }

      const updatedChannel = await ChannelModel.findByIdAndUpdate(
        channelId,
        { $addToSet: { allowedUsers: userId } },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedChannel) {
        return this.createErrorResult('Channel not found');
      }

      return this.createSuccessResult(updatedChannel as ChannelEntity);
    } catch (error) {
      console.error('Error adding user access:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * ユーザーアクセスを削除
   */
  async removeUserAccess(channelId: string, userId: string): Promise<OperationResult<ChannelEntity>> {
    try {
      if (!channelId || !userId) {
        return this.createErrorResult('Channel ID and User ID are required');
      }

      const updatedChannel = await ChannelModel.findByIdAndUpdate(
        channelId,
        { $pull: { allowedUsers: userId } },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedChannel) {
        return this.createErrorResult('Channel not found');
      }

      return this.createSuccessResult(updatedChannel as ChannelEntity);
    } catch (error) {
      console.error('Error removing user access:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネル数を取得
   */
  async getChannelCount(room?: string): Promise<OperationResult<number>> {
    try {
      const query: any = {};
      if (room) {
        query.room = room;
      }

      const count = await ChannelModel.countDocuments(query);
      return this.createSuccessResult(count);
    } catch (error) {
      console.error('Error getting channel count:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネルタイプ一覧を取得
   */
  getChannelTypes(): ChannelType[] {
    return Object.values(ChannelType);
  }

  /**
   * 複数チャンネルを取得（BaseOperationInterface実装）
   */
  async findMany(query?: Partial<ChannelEntity>, options?: QueryOptions): Promise<OperationResult<ChannelEntity[]>> {
    try {
      const mongoQuery: any = query || {};
      const limit = options?.limit || 50;
      const skip = options?.skip || 0;
      const sort = options?.sort || { position: 1 };

      const channels = await ChannelModel.find(mongoQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      return this.createSuccessResult(channels as ChannelEntity[]);
    } catch (error) {
      console.error('Error finding channels:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネル数を取得（BaseOperationInterface実装）
   */
  async count(query?: Partial<ChannelEntity>): Promise<OperationResult<number>> {
    try {
      const mongoQuery: any = query || {};
      const count = await ChannelModel.countDocuments(mongoQuery);
      return this.createSuccessResult(count);
    } catch (error) {
      console.error('Error counting channels:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * チャンネル名とルームで検索
   */
  private async findByNameAndRoom(name: string, room: string): Promise<OperationResult<ChannelEntity>> {
    try {
      const channel = await ChannelModel.findOne({ name: name.trim(), room }).lean();
      
      if (!channel) {
        return this.createErrorResult('Channel not found');
      }

      return this.createSuccessResult(channel as ChannelEntity);
    } catch (error) {
      console.error('Error finding channel by name and room:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 最後の位置を取得
   */
  private async getLastPosition(room: string, parentId?: string): Promise<OperationResult<number>> {
    try {
      const query: any = { room };
      if (parentId) {
        query.parentId = parentId;
      } else {
        query.parentId = { $exists: false };
      }

      const lastChannel = await ChannelModel.findOne(query)
        .sort({ position: -1 })
        .select('position')
        .lean();

      const lastPosition = lastChannel ? lastChannel.position : -1;
      return this.createSuccessResult(lastPosition);
    } catch (error) {
      console.error('Error getting last position:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 基本バリデーション
   */
  validate(data: unknown): ValidationResult<ChannelCreateData> {
    try {
      const createData = data as ChannelCreateData;
      const errors: ValidationError[] = [];

      if (!createData.name || typeof createData.name !== 'string' || createData.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Channel name is required' });
      }

      if (!createData.type || !Object.values(ChannelType).includes(createData.type)) {
        errors.push({ field: 'type', message: 'Valid channel type is required' });
      }

      if (!createData.room || typeof createData.room !== 'string' || createData.room.trim().length === 0) {
        errors.push({ field: 'room', message: 'Room is required' });
      }

      if (createData.name && createData.name.length > 100) {
        errors.push({ field: 'name', message: 'Channel name must be less than 100 characters' });
      }

      if (createData.description && createData.description.length > 500) {
        errors.push({ field: 'description', message: 'Description must be less than 500 characters' });
      }

      if (createData.position !== undefined && (createData.position < 0 || !Number.isInteger(createData.position))) {
        errors.push({ field: 'position', message: 'Position must be a non-negative integer' });
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
  private createErrorResult(error: string, errors?: ValidationError[]): OperationResult<any> {
    return {
      success: false,
      error,
      errors
    };
  }
}

// シングルトンインスタンス
export const channelRepository = new ChannelRepository();

export default channelRepository;
