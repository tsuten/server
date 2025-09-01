import { BaseOperation } from '../base/BaseOperation.js';
import { RoomModel } from '../models/RoomModel.js';
import { roomRepository } from '../repositories/roomRepository.js';
import { roomSchema } from '../schemas/RoomSchema.js';
import {
  RoomEntity,
  RoomCreateData,
  RoomUpdateData,
  RoomQueryOptions,
  RoomStatistics
} from '../types/room.js';
import { OperationResult, ValidationError } from '../types/base.js';

/**
 * Room操作インターフェース
 */
export interface RoomOperationInterface {
  getAllRooms(options?: RoomQueryOptions): Promise<OperationResult<RoomEntity[]>>;
  getRoomByName(name: string): Promise<OperationResult<RoomEntity | null>>;
  getDefaultRoom(): Promise<OperationResult<RoomEntity>>;
  createRoom(data: RoomCreateData): Promise<OperationResult<RoomEntity>>;
  updateRoom(id: string, data: RoomUpdateData): Promise<OperationResult<RoomEntity>>;
  archiveRoom(id: string): Promise<OperationResult<RoomEntity>>;
  activateRoom(id: string): Promise<OperationResult<RoomEntity>>;
  getRoomStatistics(roomId: string): Promise<OperationResult<RoomStatistics>>;
  incrementMessageCount(roomId: string): Promise<OperationResult<RoomEntity>>;
}

/**
 * RoomOperation クラス
 * ルーム関連のビジネスロジックを担当
 */
export class RoomOperation 
  extends BaseOperation<RoomEntity, RoomCreateData, RoomUpdateData>
  implements RoomOperationInterface {

  constructor() {
    super(RoomModel, roomSchema);
  }

  /**
   * 全てのアクティブなルームを取得
   */
  async getAllRooms(options?: RoomQueryOptions): Promise<OperationResult<RoomEntity[]>> {
    try {
      return await roomRepository.findAllActive(options);
    } catch (error) {
      console.error('Error getting all rooms:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * 名前でルームを取得
   */
  async getRoomByName(name: string): Promise<OperationResult<RoomEntity | null>> {
    try {
      if (!name || name.trim().length === 0) {
        return this.createErrorResult('Room name is required');
      }
      
      return await roomRepository.findByName(name);
    } catch (error) {
      console.error('Error getting room by name:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  /**
   * デフォルトルームを取得（存在しない場合は作成）
   */
  async getDefaultRoom(): Promise<OperationResult<RoomEntity>> {
    try {
      // 既存のデフォルトルームを検索
      const existingResult = await roomRepository.findDefaultRoom();
      
      if (existingResult.success && existingResult.data) {
        return existingResult as OperationResult<RoomEntity>;
      }

      // デフォルトルームが存在しない場合は作成
      console.log('Creating default room...');
      const createResult = await this.createRoom({
        name: 'general',
        description: 'Default general room',
        type: 'general',
        isDefault: true
      });

      return createResult;
    } catch (error) {
      console.error('Error getting default room:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to get default room');
    }
  }

  /**
   * ルーム作成
   */
  async createRoom(data: RoomCreateData): Promise<OperationResult<RoomEntity>> {
    try {
      // バリデーション
      const validation = this.validate(data);
      if (!validation.isValid) {
        return this.createErrorResult('Validation failed', validation.errors);
      }

      // デフォルトルームの特別チェック
      if (data.isDefault) {
        const existingDefault = await roomRepository.findDefaultRoom();
        if (existingDefault.success && existingDefault.data) {
          return this.createErrorResult('Default room already exists');
        }
      }

      // 名前の重複チェック
      const existingRoom = await roomRepository.findByName(data.name);
      if (existingRoom.success && existingRoom.data) {
        return this.createErrorResult('Room with this name already exists');
      }

      // ルーム作成
      const result = await this.create(validation.data!);
      
      if (result.success) {
        console.log(`Room created: ${result.data!.name} (${result.data!.type})`);
      }
      
      return result;
    } catch (error) {
      console.error('Error creating room:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to create room');
    }
  }

  /**
   * ルーム更新
   */
  async updateRoom(id: string, data: RoomUpdateData): Promise<OperationResult<RoomEntity>> {
    try {
      // 基本的なバリデーション
      if (!id) {
        return this.createErrorResult('Room ID is required');
      }

      // 名前の重複チェック（名前が変更される場合）
      if (data.name) {
        const existingRoom = await roomRepository.findByName(data.name);
        if (existingRoom.success && existingRoom.data && existingRoom.data._id !== id) {
          return this.createErrorResult('Room with this name already exists');
        }
      }

      return await this.update(id, data);
    } catch (error) {
      console.error('Error updating room:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to update room');
    }
  }

  /**
   * ルームをアーカイブ
   */
  async archiveRoom(id: string): Promise<OperationResult<RoomEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Room ID is required');
      }

      // デフォルトルームはアーカイブできない
      const room = await this.getById(id);
      if (room.success && room.data?.isDefault) {
        return this.createErrorResult('Cannot archive default room');
      }

      return await this.update(id, { status: 'archived' });
    } catch (error) {
      console.error('Error archiving room:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to archive room');
    }
  }

  /**
   * ルームをアクティブ化
   */
  async activateRoom(id: string): Promise<OperationResult<RoomEntity>> {
    try {
      if (!id) {
        return this.createErrorResult('Room ID is required');
      }

      return await this.update(id, { status: 'active' });
    } catch (error) {
      console.error('Error activating room:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to activate room');
    }
  }

  /**
   * ルーム統計情報の取得
   */
  async getRoomStatistics(roomId: string): Promise<OperationResult<RoomStatistics>> {
    try {
      if (!roomId) {
        return this.createErrorResult('Room ID is required');
      }

      return await roomRepository.getRoomStatistics(roomId);
    } catch (error) {
      console.error('Error getting room statistics:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to get room statistics');
    }
  }

  /**
   * メッセージ数の増加
   */
  async incrementMessageCount(roomId: string): Promise<OperationResult<RoomEntity>> {
    try {
      if (!roomId) {
        return this.createErrorResult('Room ID is required');
      }

      return await roomRepository.incrementMessageCount(roomId);
    } catch (error) {
      console.error('Error incrementing message count:', error);
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to increment message count');
    }
  }

  /**
   * データのサニタイズ（更新時）
   */
  protected sanitizeUpdateData(data: RoomUpdateData): Partial<RoomUpdateData> {
    const sanitized: Partial<RoomUpdateData> = { ...data };
    
    // 不要なフィールドの削除
    if (sanitized.messageCount !== undefined) {
      delete sanitized.messageCount; // メッセージ数は直接更新不可
    }
    
    return sanitized;
  }
}

// シングルトンインスタンス
export const roomOperation = new RoomOperation();

export default roomOperation;
