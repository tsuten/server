import Fastify from 'fastify'
import { Server } from 'socket.io'
import mongoInstance from './src/services/mongo.js'
import { CustomSocket } from './src/types/socket.js'
import { MessageReceiver } from './src/receivers/messageReceiver.js'
import RoomReceiver from './src/receivers/roomReceiver.js'
import ChannelReceiver from './src/receivers/channelReceiver.js'
import UserReceiver from './src/receivers/userReceiver.js'
import { createLogger, LogCategory } from './src/utils/consoleLog.js'
import { authRoutes } from './src/api/auth.js'
import { authOperation } from './src/operations/authOperation.js'
import { dataManagement } from './src/admin/DataManagement.js'
import jwt from '@fastify/jwt'
import view from '@fastify/view'
import ejs from 'ejs'
import path from 'path'

const fastify = Fastify()
const startupLogger = createLogger(LogCategory.SYSTEM, 'ServerStartup')

// JWTプラグインの登録
startupLogger.info('Registering JWT plugin')
fastify.register(jwt, {
  secret: 'secret'
})

// Viewプラグインの登録（EJSテンプレートエンジン）
const templateRoot = path.join(process.cwd(), 'src')
startupLogger.info('Registering View plugin with EJS', {
  templateRoot,
  currentDir: process.cwd()
})
fastify.register(view, {
  engine: {
    ejs: ejs
  },
  root: templateRoot,
})

// 認証関連のルートを登録
startupLogger.info('Registering auth routes at /api/auth')
fastify.register(authRoutes, { prefix: '/api/auth' })

// 管理パネルのルートを登録
startupLogger.info('Registering admin panel routes at /admin')
fastify.register(dataManagement, { prefix: '/admin' })



// ヘルスチェックエンドポイント
fastify.get('/', async (req: any, reply: any) => {
  reply.send({ 
    message: 'Community Service API Server',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth/*',
      admin: '/admin (data management panel)',
      websocket: 'ws://localhost:3000 (requires JWT token)'
    },
    example: {
      'Socket.IO Client': `
const socket = io('ws://localhost:3000', {
  query: { token: 'your_jwt_token_here' }
});

// 接続成功
socket.on('connected', (data) => console.log('Connected:', data));

// システムエラー（認証エラー含む）
socket.on('system', (data) => {
  console.log('System event:', data.type, data.message);
  if (data.type === 'auth_error') {
    // トークンが無効な場合の処理
    console.error('Authentication failed:', data.error);
  }
});
      `
    }
  })
})

// APIリスト取得エンドポイント
fastify.get('/api', async (req: any, reply: any) => {
  reply.send({
    message: 'Community Service API',
    version: '1.0.0',
    endpoints: {
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me (requires auth)',
        changePassword: 'PUT /api/auth/change-password (requires auth)',
        checkPasswordStrength: 'POST /api/auth/check-password-strength',
        passwordTips: 'GET /api/auth/password-tips',
        stats: 'GET /api/auth/stats (requires auth)'
      },
      websocket: {
        description: 'Real-time messaging via Socket.IO (Authentication required)',
        connection: 'ws://localhost:3000?token=your_jwt_token',
        authRequired: true,
        events: {
          client: [
            'sendMessage - メッセージを送信',
            'getMessages - メッセージ一覧を取得',
            'searchMessages - メッセージを検索',
            'joinRoom - ルームに参加（基本版）',
            'leaveRoom - ルームから退出（基本版）',
            'joinRoomAdvanced - ルームに参加（拡張版）',
            'leaveRoomAdvanced - ルームから退出（拡張版）',
            'getRooms - ルーム一覧を取得',
            'createRoom - ルームを作成',
            'getRoomInfo - ルーム情報を取得',
            'updateRoom - ルーム情報を更新',
            'archiveRoom - ルームをアーカイブ',
            'getRoomStats - ルーム統計を取得',
            'getChannels - チャンネル一覧を取得',
            'createChannel - チャンネルを作成',
            'getChannelInfo - チャンネル情報を取得',
            'updateChannel - チャンネル情報を更新',
            'deleteChannel - チャンネルを削除',
            'getChannelHierarchy - チャンネル階層を取得',
            'searchChannels - チャンネルを検索',
            'getChannelStats - チャンネル統計を取得',
            'updateChannelPosition - チャンネル位置を更新',
            'moveChannelToCategory - チャンネルをカテゴリに移動',
            'addUserAccess - ユーザーアクセスを追加',
            'removeUserAccess - ユーザーアクセスを削除',
            'getAccessibleChannels - アクセス可能なチャンネルを取得',
            'getUserInfo - ユーザー情報を取得',
            'createUser - ユーザーを作成',
            'updateUser - ユーザー情報を更新',
            'deleteUser - ユーザーを削除',
            'searchUsers - ユーザーを検索',
            'getOnlineUsers - オンラインユーザーを取得',
            'getUsersByType - タイプ別ユーザーを取得',
            'updateOnlineStatus - オンライン状態を更新',
            'updateUserSettings - ユーザー設定を更新',
            'updateUserType - ユーザータイプを更新',
            'getUserStatistics - ユーザー統計を取得',
            'getUsers - ユーザー一覧を取得',
            'getUserByAuthId - 認証IDでユーザーを取得',
            'getUserByEmail - メールアドレスでユーザーを検索',
            'verify_auth - 認証状態を再確認'
          ],
          server: [
            'connected - 接続成功時',
            'messageReceived - メッセージ受信時',
            'userJoined - ユーザーがルームに参加',
            'userLeft - ユーザーがルームから退出',
            'joined_room - ルーム参加確認',
            'roomCreated - ルーム作成通知',
            'roomUpdated - ルーム更新通知',
            'roomArchived - ルームアーカイブ通知',
            'forceLeaveRoom - 強制退出通知',
            'channelCreated - チャンネル作成通知',
            'channelUpdated - チャンネル更新通知',
            'channelDeleted - チャンネル削除通知',
            'channelPositionUpdated - チャンネル位置更新通知',
            'channelMovedToCategory - チャンネルカテゴリ移動通知',
            'channelAccessGranted - チャンネルアクセス許可通知',
            'channelAccessRevoked - チャンネルアクセス削除通知',
            'userJoinedChannel - ユーザーがチャンネルに参加',
            'userLeftChannel - ユーザーがチャンネルから退出',
            'userCreated - ユーザー作成通知',
            'userUpdated - ユーザー更新通知',
            'userDeleted - ユーザー削除通知',
            'userOnlineStatusChanged - ユーザーオンライン状態変更通知',
            'userTypeChanged - ユーザータイプ変更通知',
            'userSettingsUpdated - ユーザー設定更新通知',
            'userCameOnline - ユーザーがオンラインになった通知',
            'userWentOffline - ユーザーがオフラインになった通知',
            'userJoinedRoom - ユーザーがルームに参加した通知',
            'userLeftRoom - ユーザーがルームから退出した通知',
            'system - システムメッセージ（エラー含む）',
            'auth_verified - 認証確認完了'
          ]
        },
        systemEventTypes: [
          'auth_error - 認証エラー（トークン不正等）',
          'connection_error - 接続エラー',
          'rate_limit - レート制限',
          'validation_error - データ検証エラー'
        ],
        note: 'トークンを取得するには /api/auth/login または /api/auth/signup を使用してください。認証エラーは system イベントで通知されます。'
      }
    }
  })
})

const serverLogger = createLogger(LogCategory.SYSTEM, 'Server');

const start = async (port: number) => {
  try {
    // MongoDBに接続
    await mongoInstance.connect()
    
    // Fastifyサーバーを起動
    await fastify.listen({ port: port })
    
    // Socket.IOをFastifyサーバーに統合
    const io = new Server(fastify.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      }
    })
    
    // Socket.IO接続イベント
    io.on('connection', async (socket: CustomSocket) => {
      try {
        // クエリパラメータからトークンを取得
        const token = socket.handshake.query.token as string

        if (!token) {
          serverLogger.warn('Token not found, disconnecting user', { socketId: socket.id });
          socket.emit('system', {
            type: 'auth_error',
            error: 'Authentication token is required',
            message: 'トークンが必要です',
            timestamp: new Date()
          });
          socket.disconnect(true);
          return;
        }

        // トークンを検証してユーザー情報を取得
        const tokenResult = await authOperation.verifyJWTToken(token, fastify);
        
        if (!tokenResult.success || !tokenResult.data) {
          serverLogger.warn('Invalid token, disconnecting user', { 
            socketId: socket.id, 
            error: tokenResult.error 
          });
          socket.emit('system', {
            type: 'auth_error',
            error: 'Invalid or expired token',
            message: 'トークンが無効または期限切れです',
            timestamp: new Date()
          });
          socket.disconnect(true);
          return;
        }

        // ユーザー情報を取得
        const userResult = await authOperation.findById(tokenResult.data.userId);
        
        if (!userResult.success || !userResult.data) {
          serverLogger.warn('User not found, disconnecting', { 
            socketId: socket.id, 
            userId: tokenResult.data.userId 
          });
          socket.emit('system', {
            type: 'auth_error',
            error: 'User not found',
            message: 'ユーザーが見つかりません',
            timestamp: new Date()
          });
          socket.disconnect(true);
          return;
        }

        // Socket に認証情報を設定
        socket.token = token;
        socket.username = userResult.data.username;
        socket.user = userResult.data;

        serverLogger.info('User authenticated and connected', { 
          username: userResult.data.username, 
          userId: userResult.data._id,
          socketId: socket.id 
        });

        // MessageReceiverを初期化（新しいBaseReceiverベースの実装）
        const messageReceiver = new MessageReceiver(io, socket, {
          enableLogging: true,
          enableErrorHandling: true,
          enableValidation: true
        });

        // RoomReceiverを初期化
        const roomReceiver = new RoomReceiver(io, socket, {
          enableLogging: true,
          enableErrorHandling: true,
          enableValidation: true
        });

        // ChannelReceiverを初期化
        const channelReceiver = new ChannelReceiver(io, socket, {
          enableLogging: true,
          enableErrorHandling: true,
          enableValidation: true
        });
        
        // UserReceiverを初期化
        const userReceiver = new UserReceiver(io, socket, {
          enableLogging: true,
          enableErrorHandling: true,
          enableValidation: true
        });
        
        // 接続成功の通知
        socket.emit('connected', {
          success: true,
          message: 'Successfully connected to the server',
          user: {
            id: userResult.data._id,
            username: userResult.data.username
          },
          timestamp: new Date()
        });

        // ルーム参加処理（デフォルトのgeneralルーム）
        socket.join('general');
        socket.emit('joined_room', {
          room: 'general',
          message: 'generalルームに参加しました'
        });
        
        // 切断イベント
        socket.on('disconnect', (reason) => {
          serverLogger.info('User disconnected', { 
            username: socket.username, 
            userId: socket.user?._id,
            socketId: socket.id, 
            reason 
          });
          
          // MessageReceiverのリソースをクリーンアップ
          messageReceiver.cleanup();
          
          // RoomReceiverのリソースをクリーンアップ
          roomReceiver.cleanup();
          
          // ChannelReceiverのリソースをクリーンアップ
          channelReceiver.cleanup();
        });

        // 認証情報再確認のイベント（オプション）
        socket.on('verify_auth', async () => {
          try {
            const currentTokenResult = await authOperation.verifyJWTToken(socket.token!, fastify);
            
            if (!currentTokenResult.success) {
              socket.emit('system', {
                type: 'auth_error',
                error: 'Token verification failed',
                message: 'トークンの再検証に失敗しました',
                timestamp: new Date()
              });
              socket.disconnect(true);
              return;
            }

            socket.emit('auth_verified', {
              success: true,
              user: {
                id: socket.user!._id,
                username: socket.user!.username
              }
            });
          } catch (error) {
            serverLogger.error('Auth verification error', error, { socketId: socket.id });
            socket.emit('system', {
              type: 'auth_error',
              error: 'Verification failed',
              message: '認証の確認に失敗しました',
              timestamp: new Date()
            });
          }
        });

      } catch (error) {
        serverLogger.error('Socket connection error', error, { socketId: socket.id });
        socket.emit('system', {
          type: 'connection_error',
          error: 'Connection failed',
          message: '接続に失敗しました',
          timestamp: new Date()
        });
        socket.disconnect(true);
      }
    })
    
    serverLogger.info('Server running', { port });
  } catch (err) {
    serverLogger.fatal('Server startup failed', err);
    fastify.log.error(err)
    
    // MongoDB接続が失敗した場合は適切に切断
    if (mongoInstance.isDbConnected()) {
      await mongoInstance.disconnect()
    }
    
    process.exit(1)
  }
}

start(3000)