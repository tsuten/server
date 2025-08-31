/**
 * TypeScript化された構造の使用例
 */

import { messageOperation } from './src_old/operation/MessageOperation.js';
import { MessageCreateData } from './src_old/types/message.js';

// メッセージ作成の例
async function createMessageExample() {
  const messageData: MessageCreateData = {
    message: 'Hello, TypeScript!',
    username: 'developer',
    room: 'general',
    type: 'text'
  };

  const result = await messageOperation.create(messageData);
  
  if (result.success) {
    console.log('Message created:', result.data);
  } else {
    console.error('Error:', result.error);
    console.error('Validation errors:', result.errors);
  }
}

// ルーム別メッセージ取得の例
async function getRoomMessagesExample() {
  const result = await messageOperation.findByRoom('general', {
    limit: 20,
    skip: 0
  });

  if (result.success) {
    console.log(`Found ${result.data?.length} messages`);
    result.data?.forEach(message => {
      console.log(`${message.username}: ${message.message}`);
    });
  } else {
    console.error('Error:', result.error);
  }
}

// メッセージ検索の例
async function searchMessagesExample() {
  const result = await messageOperation.search('TypeScript', 'general', 10);

  if (result.success) {
    console.log(`Found ${result.data?.length} matching messages`);
  } else {
    console.error('Error:', result.error);
  }
}

// ルーム統計の例
async function getRoomStatsExample() {
  const result = await messageOperation.getRoomStatistics('general');

  if (result.success && result.data) {
    console.log('Room statistics:', {
      totalMessages: result.data.totalMessages,
      uniqueUsers: result.data.uniqueUsers,
      messagesByType: result.data.messagesByType,
      lastActivity: result.data.lastActivity
    });
  } else {
    console.error('Error:', result.error);
  }
}

export {
  createMessageExample,
  getRoomMessagesExample,
  searchMessagesExample,
  getRoomStatsExample
};


