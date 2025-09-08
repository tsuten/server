import { Server } from 'socket.io';
import { BaseSender } from '../base/BaseSender.js';
import { 
  SendPriority, 
  SendResult, 
  SenderOptions,
  MessageSenderEvents 
} from '../types/sender.js';
import { MessageEntity } from '../types/message.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';

/**
 * MessageSender クラス
 * メッセージ関連の能動的な送信処理を担当
 */
export class MessageSender extends BaseSender {
  protected logger = createLogger(LogCategory.SENDER, 'MessageSender');

  constructor(io: Server, options: SenderOptions = {}) {
    super(io, options);
  }

  /**
   * 新しいメッセージの通知
   */
  async notifyNewMessage(
    message: MessageEntity, 
    excludeUserId?: string,
    priority: SendPriority = SendPriority.HIGH
  ): Promise<SendResult> {
    const payload = {
      data: {
        message,
        channelId: message.channelId,
        senderId: message.senderId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    this.logger.info('Notifying new message', { 
      messageId: message._id, 
      channelId: message.channelId,
      excludeUserId 
    });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${message.channelId}`;

    // チャンネル内の全ユーザーに送信（送信者は除外可能）
    if (excludeUserId) {
      // Socket.IOのbroadcast機能を使って送信者以外に送信
      return this.sendToChannelExcludeUser(channelRoomName, 'newMessage', payload, excludeUserId, priority);
    } else {
      return this.sendToRoom(channelRoomName, 'newMessage', payload, priority);
    }
  }

  /**
   * メッセージ更新の通知
   */
  async notifyMessageUpdated(
    messageId: string,
    channelId: string,
    updatedData: Partial<MessageEntity>,
    updatedBy: string,
    priority: SendPriority = SendPriority.NORMAL
  ): Promise<SendResult> {
    const payload = {
      data: {
        messageId,
        updatedData,
        updatedBy,
        channelId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    this.logger.info('Notifying message updated', { messageId, channelId, updatedBy });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${channelId}`;
    return this.sendToRoom(channelRoomName, 'messageUpdated', payload, priority);
  }

  /**
   * メッセージ削除の通知
   */
  async notifyMessageDeleted(
    messageId: string,
    channelId: string,
    deletedBy: string,
    priority: SendPriority = SendPriority.NORMAL
  ): Promise<SendResult> {
    const payload = {
      data: {
        messageId,
        channelId,
        deletedBy,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    this.logger.info('Notifying message deleted', { messageId, channelId, deletedBy });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${channelId}`;
    return this.sendToRoom(channelRoomName, 'messageDeleted', payload, priority);
  }

  /**
   * チャンネル参加通知
   */
  async notifyChannelJoined(
    userId: string,
    channelId: string,
    priority: SendPriority = SendPriority.NORMAL
  ): Promise<SendResult> {
    const payload = {
      data: {
        userId,
        channelId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    this.logger.info('Notifying channel joined', { userId, channelId });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${channelId}`;
    return this.sendToRoom(channelRoomName, 'channelJoined', payload, priority);
  }

  /**
   * チャンネル退出通知
   */
  async notifyChannelLeft(
    userId: string,
    channelId: string,
    priority: SendPriority = SendPriority.NORMAL
  ): Promise<SendResult> {
    const payload = {
      data: {
        userId,
        channelId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    this.logger.info('Notifying channel left', { userId, channelId });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${channelId}`;
    return this.sendToRoom(channelRoomName, 'channelLeft', payload, priority);
  }

  /**
   * タイピング開始通知
   */
  async notifyTypingStarted(
    userId: string,
    channelId: string,
    priority: SendPriority = SendPriority.LOW
  ): Promise<SendResult> {
    const payload = {
      data: {
        userId,
        channelId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    // タイピング通知は低優先度で、送信者以外に通知
    return this.sendToChannelExcludeUser(channelId, 'typingStarted', payload, userId, priority);
  }

  /**
   * タイピング停止通知
   */
  async notifyTypingStopped(
    userId: string,
    channelId: string,
    priority: SendPriority = SendPriority.LOW
  ): Promise<SendResult> {
    const payload = {
      data: {
        userId,
        channelId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    // タイピング通知は低優先度で、送信者以外に通知
    return this.sendToChannelExcludeUser(channelId, 'typingStopped', payload, userId, priority);
  }

  /**
   * メンション通知
   */
  async notifyMentioned(
    mentionedUserId: string,
    messageId: string,
    senderId: string,
    channelId: string,
    priority: SendPriority = SendPriority.HIGH
  ): Promise<SendResult> {
    const payload = {
      data: {
        mentionedUserId,
        messageId,
        senderId,
        channelId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    this.logger.info('Notifying user mentioned', { 
      mentionedUserId, 
      messageId, 
      senderId, 
      channelId 
    });

    // メンションは高優先度で個人に送信
    return this.sendToUser(mentionedUserId, 'mentionNotification', payload, priority);
  }

  /**
   * メッセージ送信確認（送信者へのエコー）
   */
  async confirmMessageSent(
    senderId: string,
    message: MessageEntity,
    priority: SendPriority = SendPriority.HIGH
  ): Promise<SendResult> {
    this.logger.debug('Confirming message sent', { senderId, messageId: message._id });

    const payload = {
      data: {
        message,
        senderId,
        channelId: message.channelId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    return this.sendToUser(senderId, 'messageSent', payload, priority);
  }

  /**
   * バッチでメンション通知を送信
   */
  async notifyMultipleMentions(
    mentions: Array<{
      mentionedUserId: string;
      messageId: string;
      senderId: string;
      channelId: string;
    }>,
    priority: SendPriority = SendPriority.HIGH
  ): Promise<SendResult[]> {
    this.logger.info('Sending batch mention notifications', { count: mentions.length });

    const results = await Promise.all(
      mentions.map(mention => 
        this.notifyMentioned(
          mention.mentionedUserId,
          mention.messageId,
          mention.senderId,
          mention.channelId,
          priority
        )
      )
    );

    return results;
  }

  /**
   * チャンネル内の特定ユーザーを除外して送信（カスタムヘルパー）
   */
  private async sendToChannelExcludeUser(
    channelId: string,
    event: string,
    data: any,
    excludeUserId: string,
    priority: SendPriority = SendPriority.NORMAL
  ): Promise<SendResult> {
    // Socket.IOのbroadcast機能を使用して除外送信をシミュレート
    // 実際の実装では、チャンネルの参加者リストを取得して個別送信する方法もある
    
    this.logger.debug('Sending to channel excluding user', { 
      channelId, 
      event, 
      excludeUserId 
    });

    // 現在はルーム全体への送信として実装
    // 将来的にはチャンネル参加者の取得とフィルタリングを実装可能
    return this.sendToRoom(channelId, event, data, priority);
  }

  /**
   * メッセージ関連の統計情報を送信
   */
  async sendMessageStatistics(
    targetUserId: string,
    statistics: {
      totalMessages: number;
      channelMessageCounts: Record<string, number>;
      recentActivity: any[];
    },
    priority: SendPriority = SendPriority.LOW
  ): Promise<SendResult> {
    this.logger.debug('Sending message statistics', { targetUserId });

    const payload = {
      data: {
        statistics,
        targetUserId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    return this.sendToUser(targetUserId, 'messageStatistics', payload, priority);
  }

  /**
   * システムメッセージの送信
   */
  async sendSystemMessage(
    channelId: string,
    message: string,
    messageType: 'info' | 'warning' | 'error' = 'info',
    priority: SendPriority = SendPriority.NORMAL
  ): Promise<SendResult> {
    const payload = {
      data: {
        message,
        type: 'system',
        messageType,
        senderId: 'system',
        channelId,
        timestamp: new Date(),
        serverId: "unknown" // TODO: 適切なサーバーIDを設定
      }
    };

    this.logger.info('Sending system message', { channelId, messageType, message });

    return this.sendToRoom(channelId, 'systemMessage', payload, priority);
  }

  /**
   * 永続的に失敗したジョブの処理をオーバーライド
   */
  protected onJobFailedPermanently(job: any, error?: string): void {
    this.logger.error('Message send job failed permanently', { 
      jobId: job.id, 
      event: job.event,
      targets: job.targets,
      error 
    });

    // 必要に応じて、失敗したメッセージ送信をデータベースに記録したり、
    // 管理者に通知したりする処理を追加
  }
}

export default MessageSender;
