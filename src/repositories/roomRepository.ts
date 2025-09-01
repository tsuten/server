import { RoomModel } from '../models/RoomModel.js';
import { RoomEntity, RoomQueryOptions, RoomStatistics } from '../types/room.js';
import { OperationResult } from '../types/base.js';

/**
 * ルームリポジトリクラス
 * ルームデータアクセス層
 */
export class RoomRepository {
  private model = RoomModel;

  /**
   * 全てのアクティブなルームを取得
   */
  async findAllActive(options?: RoomQueryOptions): Promise<OperationResult<RoomEntity[]>> {
    try {
      const query = this.model.find({ status: 'active' });
      
      if (options?.type) query.where('type', options.type);
      if (options?.name) query.where('name', new RegExp(options.name, 'i'));
      if (options?.isDefault !== undefined) query.where('isDefault', options.isDefault);
      
      if (options?.sort) query.sort(options.sort);
      else query.sort({ lastActivity: -1 });
      
      if (options?.limit) query.limit(options.limit);
      if (options?.skip) query.skip(options.skip);
      
      const rooms = await query.lean().exec();
      
      return {
        success: true,
        data: rooms as RoomEntity[]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch rooms'
      };
    }
  }

  /**
   * 名前でルームを検索
   */
  async findByName(name: string): Promise<OperationResult<RoomEntity | null>> {
    try {
      const room = await this.model.findOne({ 
        name: name.trim(),
        status: 'active'
      }).lean().exec();
      
      return {
        success: true,
        data: room as RoomEntity | null
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find room'
      };
    }
  }

  /**
   * デフォルトルームを取得
   */
  async findDefaultRoom(): Promise<OperationResult<RoomEntity | null>> {
    try {
      const room = await this.model.findOne({ 
        isDefault: true,
        status: 'active'
      }).lean().exec();
      
      return {
        success: true,
        data: room as RoomEntity | null
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find default room'
      };
    }
  }

  /**
   * ルーム統計情報を取得
   */
  async getRoomStatistics(roomId: string): Promise<OperationResult<RoomStatistics>> {
    try {
      const room = await this.model.findById(roomId).lean().exec();
      if (!room) {
        return {
          success: false,
          error: 'Room not found'
        };
      }

      // MessageModelから統計情報を取得（実際にはMessageRepositoryを使用することを想定）
      const stats: RoomStatistics = {
        totalMessages: room.messageCount || 0,
        lastActivity: room.lastActivity || null,
        messagesByType: {}, // 実際の実装では集計クエリを使用
        uniqueUsers: 0 // 実際の実装では集計クエリを使用
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get room statistics'
      };
    }
  }

  /**
   * アクティビティの更新
   */
  async updateActivity(roomId: string): Promise<OperationResult<RoomEntity>> {
    try {
      const room = await this.model.findByIdAndUpdate(
        roomId,
        { lastActivity: new Date() },
        { new: true }
      ).lean().exec();

      if (!room) {
        return {
          success: false,
          error: 'Room not found'
        };
      }

      return {
        success: true,
        data: room as RoomEntity
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update activity'
      };
    }
  }

  /**
   * メッセージ数の増加
   */
  async incrementMessageCount(roomId: string): Promise<OperationResult<RoomEntity>> {
    try {
      const room = await this.model.findByIdAndUpdate(
        roomId,
        { 
          $inc: { messageCount: 1 },
          lastActivity: new Date()
        },
        { new: true }
      ).lean().exec();

      if (!room) {
        return {
          success: false,
          error: 'Room not found'
        };
      }

      return {
        success: true,
        data: room as RoomEntity
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to increment message count'
      };
    }
  }
}

// シングルトンインスタンス
export const roomRepository = new RoomRepository();

export default roomRepository;
