import { BaseReceiver, ReceiverOptions } from '../base/BaseReceiver.js';
import { roomOperation } from '../operations/roomOperation.js';
import { CustomSocket } from '../types/socket.js';
import { Server } from 'socket.io';
import {
  RoomEntity,
  RoomCreateData,
  RoomUpdateData,
  RoomQueryOptions
} from '../types/room.js';

/**
 * ルームレシーバークラス
 * Socket.io通信でのルーム関連操作を処理
 */
export class RoomReceiver extends BaseReceiver<RoomEntity, RoomCreateData, RoomUpdateData> {
  protected declare socket: CustomSocket;
  private roomOp = roomOperation;
  
  constructor(io: Server, socket: CustomSocket, options: ReceiverOptions = {}) {
    super(io, socket, roomOperation, options);
  }

  /**
   * カスタムイベントハンドラーを設定
   */
  protected setupEventHandlers(): void {
    // ルーム一覧取得
    this.addEventHandler('getRooms', this.handleGetRooms.bind(this));

    // ルーム作成
    this.addEventHandler('createRoom', this.handleCreateRoom.bind(this));

    // ルーム情報取得
    this.addEventHandler('getRoomInfo', this.handleGetRoomInfo.bind(this));

    // ルーム更新
    this.addEventHandler('updateRoom', this.handleUpdateRoom.bind(this));

    // ルームアーカイブ
    this.addEventHandler('archiveRoom', this.handleArchiveRoom.bind(this));

    // ルーム統計取得
    this.addEventHandler('getRoomStats', this.handleGetRoomStats.bind(this));

    // ルーム参加（拡張版）
    this.addEventHandler('joinRoomAdvanced', this.handleJoinRoom.bind(this));

    // ルーム退出（拡張版）
    this.addEventHandler('leaveRoomAdvanced', this.handleLeaveRoom.bind(this));
  }

  /**
   * ルーム一覧取得ハンドラー
   */
  private async handleGetRooms(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const options: RoomQueryOptions = {
        type: data?.type,
        limit: data?.limit || 50,
        skip: data?.skip || 0,
        sort: data?.sort || { lastActivity: -1 }
      };

      return await this.roomOp.getAllRooms(options);
    }, callback);
  }

  /**
   * ルーム作成ハンドラー
   */
  private async handleCreateRoom(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const createData: RoomCreateData = {
        name: data.name,
        description: data.description,
        type: data.type || 'general',
        isDefault: data.isDefault || false
      };

      const result = await this.roomOp.createRoom(createData);
      
      if (result.success) {
        // 全クライアントに新しいルーム作成を通知
        this.socket.broadcast.emit('roomCreated', {
          room: result.data,
          createdBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ルーム情報取得ハンドラー
   */
  private async handleGetRoomInfo(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { roomId, roomName } = data;
      
      if (roomId) {
        return await this.roomOp.findById(roomId);
      } else if (roomName) {
        return await this.roomOp.getRoomByName(roomName);
      } else {
        throw new Error('Room ID or name is required');
      }
    }, callback);
  }

  /**
   * ルーム更新ハンドラー
   */
  private async handleUpdateRoom(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { roomId, ...updateData } = data;
      
      if (!roomId) {
        throw new Error('Room ID is required');
      }

      const result = await this.roomOp.updateRoom(roomId, updateData);
      
      if (result.success) {
        // 全クライアントにルーム更新を通知
        this.socket.broadcast.emit('roomUpdated', {
          room: result.data,
          updatedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ルームアーカイブハンドラー
   */
  private async handleArchiveRoom(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { roomId } = data;
      
      if (!roomId) {
        throw new Error('Room ID is required');
      }

      const result = await this.roomOp.archiveRoom(roomId);
      
      if (result.success) {
        // 全クライアントにルームアーカイブを通知
        this.socket.broadcast.emit('roomArchived', {
          roomId: roomId,
          archivedBy: this.socket.username,
          timestamp: new Date()
        });
        
        // そのルームにいる全ユーザーをデフォルトルームに移動
        this.socket.in(roomId).emit('forceLeaveRoom', {
          reason: 'Room has been archived',
          redirectTo: 'general'
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ルーム統計取得ハンドラー
   */
  private async handleGetRoomStats(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { roomId } = data;
      
      if (!roomId) {
        throw new Error('Room ID is required');
      }

      return await this.roomOp.getRoomStatistics(roomId);
    }, callback);
  }

  /**
   * ルーム参加ハンドラー（拡張版）
   */
  private async handleJoinRoom(data: any, callback?: (response: any) => void): Promise<void> {
    const { room, roomId } = data;
    
    if (!room && !roomId) {
      const errorResponse = this.createErrorResponse('Room name or ID is required');
      if (callback) callback(errorResponse);
      return;
    }

    try {
      let roomName = room;
      
      // roomIdが提供された場合は、ルーム情報を取得
      if (roomId) {
        const roomResult = await this.roomOp.findById(roomId);
        if (!roomResult.success || !roomResult.data) {
          const errorResponse = this.createErrorResponse('Room not found');
          if (callback) callback(errorResponse);
          return;
        }
        roomName = roomResult.data.name;
      }

      // ルームに参加
      this.joinRoom(roomName);
      
      // ルームのアクティビティを更新
      if (roomId) {
        await this.roomOp.incrementMessageCount(roomId);
      }

      // ルームの他のメンバーに通知
      this.socket.to(roomName).emit('userJoined', {
        username: this.socket.username,
        userId: this.socket.user?._id,
        room: roomName,
        timestamp: new Date()
      });

      // 成功レスポンス
      const successResponse = this.createSuccessResponse({ 
        room: roomName, 
        username: this.socket.username,
        userId: this.socket.user?._id 
      }, 'Successfully joined room');
      if (callback) callback(successResponse);

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to join room'
      );
      if (callback) callback(errorResponse);
    }
  }

  /**
   * ルーム退出ハンドラー（拡張版）
   */
  private async handleLeaveRoom(data: any, callback?: (response: any) => void): Promise<void> {
    const { room, roomId } = data;
    
    if (!room && !roomId) {
      const errorResponse = this.createErrorResponse('Room name or ID is required');
      if (callback) callback(errorResponse);
      return;
    }

    try {
      let roomName = room;
      
      // roomIdが提供された場合は、ルーム情報を取得
      if (roomId) {
        const roomResult = await this.roomOp.findById(roomId);
        if (!roomResult.success || !roomResult.data) {
          const errorResponse = this.createErrorResponse('Room not found');
          if (callback) callback(errorResponse);
          return;
        }
        roomName = roomResult.data.name;
      }

      // ルームから退出
      this.leaveRoom(roomName);

      // ルームの他のメンバーに通知
      this.socket.to(roomName).emit('userLeft', {
        username: this.socket.username,
        userId: this.socket.user?._id,
        room: roomName,
        timestamp: new Date()
      });

      // 成功レスポンス
      const successResponse = this.createSuccessResponse({ 
        room: roomName, 
        username: this.socket.username,
        userId: this.socket.user?._id 
      }, 'Successfully left room');
      if (callback) callback(successResponse);

    } catch (error) {
      const errorResponse = this.createErrorResponse(
        error instanceof Error ? error.message : 'Failed to leave room'
      );
      if (callback) callback(errorResponse);
    }
  }
}

export default RoomReceiver;
