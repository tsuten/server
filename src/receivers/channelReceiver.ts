import { BaseReceiver, ReceiverOptions } from '../base/BaseReceiver.js';
import { channelOperation } from '../operations/channelOperation.js';
import { CustomSocket } from '../types/socket.js';
import { Server } from 'socket.io';
import {
  ChannelEntity,
  ChannelCreateData,
  ChannelUpdateData,
  ChannelQueryOptions,
  ChannelType
} from '../types/channel.js';

/**
 * チャンネルレシーバークラス
 * Socket.io通信でのチャンネル関連操作を処理
 */
export class ChannelReceiver extends BaseReceiver<ChannelEntity, ChannelCreateData, ChannelUpdateData> {
  protected declare socket: CustomSocket;
  private channelOp = channelOperation;
  
  constructor(io: Server, socket: CustomSocket, options: ReceiverOptions = {}) {
    super(io, socket, channelOperation, options);
  }

  /**
   * カスタムイベントハンドラーを設定
   */
  protected setupEventHandlers(): void {
    // チャンネル一覧取得
    this.addEventHandler('getChannels', this.handleGetChannels.bind(this));

    // チャンネル作成
    this.addEventHandler('createChannel', this.handleCreateChannel.bind(this));

    // チャンネル情報取得
    this.addEventHandler('getChannelInfo', this.handleGetChannelInfo.bind(this));

    // チャンネル更新
    this.addEventHandler('updateChannel', this.handleUpdateChannel.bind(this));

    // チャンネル削除
    this.addEventHandler('deleteChannel', this.handleDeleteChannel.bind(this));

    // チャンネル階層取得
    this.addEventHandler('getChannelHierarchy', this.handleGetChannelHierarchy.bind(this));

    // チャンネル検索
    this.addEventHandler('searchChannels', this.handleSearchChannels.bind(this));

    // チャンネル統計取得
    this.addEventHandler('getChannelStats', this.handleGetChannelStats.bind(this));

    // チャンネル位置更新
    this.addEventHandler('updateChannelPosition', this.handleUpdateChannelPosition.bind(this));

    // チャンネルをカテゴリに移動
    this.addEventHandler('moveChannelToCategory', this.handleMoveChannelToCategory.bind(this));

    // ユーザーアクセス管理
    this.addEventHandler('addUserAccess', this.handleAddUserAccess.bind(this));
    this.addEventHandler('removeUserAccess', this.handleRemoveUserAccess.bind(this));

    // アクセス可能なチャンネル取得
    this.addEventHandler('getAccessibleChannels', this.handleGetAccessibleChannels.bind(this));
  }

  /**
   * チャンネル一覧取得ハンドラー
   */
  private async handleGetChannels(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const options: ChannelQueryOptions = {
        room: data?.room,
        type: data?.type,
        parentId: data?.parentId,
        isPrivate: data?.isPrivate,
        userId: data?.userId,
        limit: data?.limit || 50,
        skip: data?.skip || 0,
        sort: data?.sort || { position: 1 }
      };

      if (options.userId) {
        // ユーザーがアクセス可能なチャンネルのみ取得
        return await this.channelOp.findAccessibleByUser(options.userId, options.room);
      } else {
        // ルーム内の全チャンネルを取得
        return await this.channelOp.findByRoom(options.room || 'general', options);
      }
    }, callback);
  }

  /**
   * チャンネル作成ハンドラー
   */
  private async handleCreateChannel(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const createData: ChannelCreateData = {
        name: data.name,
        type: data.type || ChannelType.TEXT,
        description: data.description,
        room: data.room || 'general',
        parentId: data.parentId,
        position: data.position,
        isPrivate: data.isPrivate || false,
        allowedUsers: data.allowedUsers,
        settings: data.settings
      };

      const result = await this.channelOp.create(createData);
      
      if (result.success) {
        // ルーム内の全クライアントに新しいチャンネル作成を通知
        this.socket.to(createData.room).emit('channelCreated', {
          channel: result.data,
          createdBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * チャンネル情報取得ハンドラー
   */
  private async handleGetChannelInfo(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { channelId, channelName, room } = data;
      
      if (channelId) {
        return await this.channelOp.findById(channelId);
      } else if (channelName && room) {
        return await this.channelOp.findByName(channelName, room);
      } else {
        throw new Error('Channel ID or name with room is required');
      }
    }, callback);
  }

  /**
   * チャンネル更新ハンドラー
   */
  private async handleUpdateChannel(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { channelId, ...updateData } = data;
      
      if (!channelId) {
        throw new Error('Channel ID is required');
      }

      const result = await this.channelOp.update(channelId, updateData);
      
      if (result.success) {
        // ルーム内の全クライアントにチャンネル更新を通知
        this.socket.to(result.data!.room).emit('channelUpdated', {
          channel: result.data,
          updatedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * チャンネル削除ハンドラー
   */
  private async handleDeleteChannel(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { channelId } = data;
      
      if (!channelId) {
        throw new Error('Channel ID is required');
      }

      // 削除前にチャンネル情報を取得（通知用）
      const channelInfo = await this.channelOp.findById(channelId);
      const room = channelInfo.success ? channelInfo.data!.room : null;

      const result = await this.channelOp.delete(channelId);
      
      if (result.success && room) {
        // ルーム内の全クライアントにチャンネル削除を通知
        this.socket.to(room).emit('channelDeleted', {
          channelId: channelId,
          deletedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * チャンネル階層取得ハンドラー
   */
  private async handleGetChannelHierarchy(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { room } = data;
      
      if (!room) {
        throw new Error('Room is required');
      }

      return await this.channelOp.getChannelHierarchy(room);
    }, callback);
  }

  /**
   * チャンネル検索ハンドラー
   */
  private async handleSearchChannels(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { keyword, room, limit } = data;
      
      if (!keyword) {
        throw new Error('Search keyword is required');
      }

      return await this.channelOp.searchChannels(keyword, room, limit);
    }, callback);
  }

  /**
   * チャンネル統計取得ハンドラー
   */
  private async handleGetChannelStats(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { room } = data;

      return await this.channelOp.getChannelStatistics(room);
    }, callback);
  }

  /**
   * チャンネル位置更新ハンドラー
   */
  private async handleUpdateChannelPosition(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { channelId, position } = data;
      
      if (!channelId || position === undefined) {
        throw new Error('Channel ID and position are required');
      }

      const result = await this.channelOp.updatePosition(channelId, position);
      
      if (result.success) {
        // ルーム内の全クライアントに位置変更を通知
        this.socket.to(result.data!.room).emit('channelPositionUpdated', {
          channelId: channelId,
          position: position,
          updatedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * チャンネルをカテゴリに移動ハンドラー
   */
  private async handleMoveChannelToCategory(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { channelId, categoryId } = data;
      
      if (!channelId) {
        throw new Error('Channel ID is required');
      }

      const result = await this.channelOp.moveToCategory(channelId, categoryId);
      
      if (result.success) {
        // ルーム内の全クライアントにカテゴリ移動を通知
        this.socket.to(result.data!.room).emit('channelMovedToCategory', {
          channelId: channelId,
          categoryId: categoryId,
          movedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ユーザーアクセス追加ハンドラー
   */
  private async handleAddUserAccess(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { channelId, userId } = data;
      
      if (!channelId || !userId) {
        throw new Error('Channel ID and User ID are required');
      }

      const result = await this.channelOp.addUserAccess(channelId, userId);
      
      if (result.success) {
        // 対象ユーザーにアクセス許可を通知
        this.socket.to(userId).emit('channelAccessGranted', {
          channel: result.data,
          grantedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * ユーザーアクセス削除ハンドラー
   */
  private async handleRemoveUserAccess(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { channelId, userId } = data;
      
      if (!channelId || !userId) {
        throw new Error('Channel ID and User ID are required');
      }

      const result = await this.channelOp.removeUserAccess(channelId, userId);
      
      if (result.success) {
        // 対象ユーザーにアクセス削除を通知
        this.socket.to(userId).emit('channelAccessRevoked', {
          channelId: channelId,
          revokedBy: this.socket.username,
          timestamp: new Date()
        });
      }
      
      return result;
    }, callback);
  }

  /**
   * アクセス可能なチャンネル取得ハンドラー
   */
  private async handleGetAccessibleChannels(data: any, callback?: (response: any) => void): Promise<void> {
    await this.safeExecute(async () => {
      const { userId, room } = data;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      return await this.channelOp.findAccessibleByUser(userId, room);
    }, callback);
  }

  /**
   * チャンネル参加（Socket.ioのルーム機能を使用）
   */
  joinChannel(channelName: string): void {
    try {
      this.socket.join(channelName);
      this.socket.to(channelName).emit('userJoinedChannel', {
        username: this.socket.username,
        userId: this.socket.user?._id,
        channel: channelName,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error joining channel:', error);
    }
  }

  /**
   * チャンネル退出（Socket.ioのルーム機能を使用）
   */
  leaveChannel(channelName: string): void {
    try {
      this.socket.leave(channelName);
      this.socket.to(channelName).emit('userLeftChannel', {
        username: this.socket.username,
        userId: this.socket.user?._id,
        channel: channelName,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error leaving channel:', error);
    }
  }

  /**
   * チャンネル内でメッセージを送信
   */
  sendToChannel(channelName: string, event: string, data: any): void {
    try {
      this.socket.to(channelName).emit(event, {
        ...data,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error sending message to channel:', error);
    }
  }

  /**
   * チャンネル内でメッセージをブロードキャスト（自分も含む）
   */
  broadcastToChannel(channelName: string, event: string, data: any): void {
    try {
      this.socket.in(channelName).emit(event, {
        ...data,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error broadcasting message to channel:', error);
    }
  }
}

export default ChannelReceiver;
