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
    const data: MessageSenderEvents['newMessage'] = {
      message,
      channelId: message.channelId,
      senderId: message.senderId
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
      return this.sendToChannelExcludeUser(channelRoomName, 'newMessage', data, excludeUserId, priority);
    } else {
      return this.sendToRoom(channelRoomName, 'newMessage', data, priority);
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
    const data: MessageSenderEvents['messageUpdated'] = {
      messageId,
      updatedData,
      updatedBy
    };

    this.logger.info('Notifying message updated', { messageId, channelId, updatedBy });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${channelId}`;
    return this.sendToRoom(channelRoomName, 'messageUpdated', data, priority);
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
    const data: MessageSenderEvents['messageDeleted'] = {
      messageId,
      channelId,
      deletedBy
    };

    this.logger.info('Notifying message deleted', { messageId, channelId, deletedBy });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${channelId}`;
    return this.sendToRoom(channelRoomName, 'messageDeleted', data, priority);
  }

  /**
   * チャンネル参加通知
   */
  async notifyChannelJoined(
    userId: string,
    channelId: string,
    priority: SendPriority = SendPriority.NORMAL
  ): Promise<SendResult> {
    const data: MessageSenderEvents['channelJoined'] = {
      userId,
      channelId,
      timestamp: new Date()
    };

    this.logger.info('Notifying channel joined', { userId, channelId });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${channelId}`;
    return this.sendToRoom(channelRoomName, 'channelJoined', data, priority);
  }

  /**
   * チャンネル退出通知
   */
  async notifyChannelLeft(
    userId: string,
    channelId: string,
    priority: SendPriority = SendPriority.NORMAL
  ): Promise<SendResult> {
    const data: MessageSenderEvents['channelLeft'] = {
      userId,
      channelId,
      timestamp: new Date()
    };

    this.logger.info('Notifying channel left', { userId, channelId });

    // チャンネルルーム名を「channel:」プレフィックス付きに変換
    const channelRoomName = `channel:${channelId}`;
    return this.sendToRoom(channelRoomName, 'channelLeft', data, priority);
  }

  /**
   * タイピング開始通知
   */
  async notifyTypingStarted(
    userId: string,
    channelId: string,
    priority: SendPriority = SendPriority.LOW
  ): Promise<SendResult> {
    const data: MessageSenderEvents['typingStarted'] = {
      userId,
      channelId
    };

    // タイピング通知は低優先度で、送信者以外に通知
    return this.sendToChannelExcludeUser(channelId, 'typingStarted', data, userId, priority);
  }

  /**
   * タイピング停止通知
   */
  async notifyTypingStopped(
    userId: string,
    channelId: string,
    priority: SendPriority = SendPriority.LOW
  ): Promise<SendResult> {
    const data: MessageSenderEvents['typingStopped'] = {
      userId,
      channelId
    };

    // タイピング通知は低優先度で、送信者以外に通知
    return this.sendToChannelExcludeUser(channelId, 'typingStopped', data, userId, priority);
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
    const data: MessageSenderEvents['mentionNotification'] = {
      mentionedUserId,
      messageId,
      senderId,
      channelId
    };

    this.logger.info('Notifying user mentioned', { 
      mentionedUserId, 
      messageId, 
      senderId, 
      channelId 
    });

    // メンションは高優先度で個人に送信
    return this.sendToUser(mentionedUserId, 'mentionNotification', data, priority);
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

    return this.sendToUser(senderId, 'messageSent', { message }, priority);
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

    return this.sendToUser(targetUserId, 'messageStatistics', statistics, priority);
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
    const data = {
      message,
      type: 'system',
      messageType,
      senderId: 'system',
      channelId,
      timestamp: new Date()
    };

    this.logger.info('Sending system message', { channelId, messageType, message });

    return this.sendToRoom(channelId, 'systemMessage', data, priority);
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
