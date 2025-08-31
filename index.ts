import Fastify from 'fastify'
import { Server } from 'socket.io'
import mongoInstance from './src/services/mongo.js'
import { CustomSocket } from './src/types/socket.js'
import { MessageReceiver } from './src/receivers/messageReceiver.js'
import { createLogger, LogCategory } from './src/utils/consoleLog.js'

const fastify = Fastify({
  logger: true
})

const logger = createLogger(LogCategory.SYSTEM, 'Server');

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
    io.on('connection', (socket: CustomSocket) => {
      // クエリパラメータからユーザー名を取得
      const username: string = socket.handshake.query.username as string

      if (!username) {
        logger.warn('Username not found, disconnecting user', { socketId: socket.id });
        socket.disconnect()
        return
      }

      socket.username = username

      // MessageReceiverを初期化（新しいBaseReceiverベースの実装）
      const messageReceiver = new MessageReceiver(io, socket, {
        enableLogging: true,
        enableErrorHandling: true,
        enableValidation: true
      })
      
      // 接続時の初期処理
      socket.emit('connected', {
        message: 'Successfully connected to the server',
        username: username,
        timestamp: new Date()
      })

      logger.info('User connected', { username, socketId: socket.id });
      
      socket.on('disconnect', (reason) => {
        logger.info('User disconnected', { username, socketId: socket.id, reason });
        
        // MessageReceiverのリソースをクリーンアップ
        messageReceiver.cleanup()
      })
    })
    
    logger.info('Server running', { port });
  } catch (err) {
    logger.fatal('Server startup failed', err);
    fastify.log.error(err)
    
    // MongoDB接続が失敗した場合は適切に切断
    if (mongoInstance.isDbConnected()) {
      await mongoInstance.disconnect()
    }
    
    process.exit(1)
  }
}

start(3000)