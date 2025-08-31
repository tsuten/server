import mongoose from 'mongoose'

class MongoDB {
  connection: mongoose.Connection | null
  isConnected: boolean
  shuttingDown: boolean
  signalHandlersRegistered: boolean

  constructor() {
    this.connection = null
    this.isConnected = false
    this.shuttingDown = false
    this.signalHandlersRegistered = false
  }

  async connect(uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/community-service') {
    if (this.isConnected) {
      console.log('MongoDB is already connected')
      return this.connection
    }

    try {
      const options = {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      }

      await mongoose.connect(uri, options)
      this.connection = mongoose.connection
      this.isConnected = true

      console.log('MongoDB connected successfully')

      // 接続エラーハンドリング
      this.connection.on('error', (error: Error) => {
        console.error('MongoDB connection error:', error)
        this.isConnected = false
      })

      // 接続切断ハンドリング  
      this.connection.on('disconnected', () => {
        console.log('MongoDB disconnected')
        this.isConnected = false
      })

      // プロセス終了時に接続を閉じる（重複登録を防ぐ）
      if (!this.signalHandlersRegistered) {
        process.on('SIGINT', this.gracefulShutdown.bind(this))
        process.on('SIGTERM', this.gracefulShutdown.bind(this))
        this.signalHandlersRegistered = true
      }

      return this.connection
    } catch (error) {
      console.error('MongoDB connection failed:', error)
      this.isConnected = false
      throw error
    }
  }

  async disconnect() {
    if (this.isConnected && !this.shuttingDown) {
      this.shuttingDown = true
      try {
        await mongoose.connection.close()
        this.isConnected = false
        console.log('MongoDB disconnected gracefully')
      } catch (error) {
        console.error('Error during MongoDB disconnect:', error)
      }
    }
  }

  async gracefulShutdown(signal: string) {
    if (this.shuttingDown) {
      return
    }
    
    console.log(`\nReceived ${signal}. Shutting down gracefully...`)
    this.shuttingDown = true
    
    try {
      if (this.isConnected) {
        await mongoose.connection.close()
        this.isConnected = false
        console.log('MongoDB disconnected gracefully')
      }
      
      console.log('Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      console.error('Error during graceful shutdown:', error)
      process.exit(1)
    }
  }

  getConnection() {
    if (!this.isConnected) {
      throw new Error('MongoDB is not connected. Call connect() first.')
    }
    return this.connection
  }

  isDbConnected() {
    return this.isConnected
  }
}

// シングルトンインスタンスを作成してエクスポート
const mongoInstance = new MongoDB()

export default mongoInstance
