import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authOperation } from '../operations/authOperation.js';
import { calculatePasswordStrength, getPasswordTips, generatePasswordExample } from '../utils/passwordStrength.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';

const logger = createLogger(LogCategory.AUTH, 'AuthAPI');

/**
 * 認証関連のAPIエンドポイント
 * Fastifyプラグインとして実装
 */
export async function authRoutes(fastify: FastifyInstance) {
  
  /**
   * ユーザー登録エンドポイント
   * POST /api/auth/signup
   */
  fastify.post('/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      logger.info('Signup request received', { username: body?.username });
      
      // 入力データの基本チェック
      if (!body || !body.username || !body.password) {
        return reply.status(400).send({
          success: false,
          error: 'ユーザー名とパスワードは必須です'
        });
      }

      // AuthOperationを使用してユーザー登録
      const registerResult = await authOperation.register({
        username: body.username,
        password: body.password,
        confirmPassword: body.confirmPassword
      });

      if (!registerResult.success) {
        logger.warn('Signup failed', { 
          username: body.username, 
          error: registerResult.error,
          errors: registerResult.errors 
        });
        
        return reply.status(400).send({
          success: false,
          error: registerResult.error || 'Registration failed',
          errors: registerResult.errors
        });
      }

      // JWT トークンを生成
      const token = authOperation.generateJWTToken(registerResult.data!, fastify);
      
      if (!token) {
        logger.error('Token generation failed', { username: body.username });
        return reply.status(500).send({
          success: false,
          error: 'トークンの生成に失敗しました'
        });
      }

      logger.info('Signup successful', { username: body.username });
      
      return reply.send({
        success: true,
        message: 'ユーザー登録が完了しました',
        token,
        user: {
          id: registerResult.data!._id,
          username: registerResult.data!.username
        }
      });
    } catch (error) {
      const body = request.body as any;
      logger.error('Signup error', error, { username: body?.username });
      return reply.status(500).send({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });

  /**
   * ユーザーログインエンドポイント
   * POST /api/auth/login
   */
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      logger.info('Login request received', { username: body?.username });
      
      // 入力データの基本チェック
      if (!body || !body.username || !body.password) {
        return reply.status(400).send({
          success: false,
          error: 'ユーザー名とパスワードは必須です'
        });
      }

      // AuthOperationを使用してログイン
      const loginResult = await authOperation.login({
        username: body.username,
        password: body.password
      });

      if (!loginResult.success) {
        logger.warn('Login failed', { 
          username: body.username, 
          error: loginResult.error 
        });
        
        return reply.status(401).send({
          success: false,
          error: loginResult.error || 'ログインに失敗しました'
        });
      }

      // JWT トークンを生成
      const token = authOperation.generateJWTToken(loginResult.data!, fastify);
      
      if (!token) {
        logger.error('Token generation failed', { username: body.username });
        return reply.status(500).send({
          success: false,
          error: 'トークンの生成に失敗しました'
        });
      }

      logger.info('Login successful', { username: body.username });
      
      return reply.send({
        success: true,
        message: 'ログインが完了しました',
        token,
        user: {
          id: loginResult.data!._id,
          username: loginResult.data!.username
        }
      });
    } catch (error) {
      const body = request.body as any;
      logger.error('Login error', error, { username: body?.username });
      return reply.status(500).send({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });

  /**
   * ログアウトエンドポイント
   * POST /api/auth/logout
   */
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 現在はクライアント側でトークンを削除するだけ
      // 将来的にはトークンブラックリスト機能を実装可能
      logger.info('Logout request received');
      
      return reply.send({
        success: true,
        message: 'ログアウトしました'
      });
    } catch (error) {
      logger.error('Logout error', error);
      return reply.status(500).send({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });

  /**
   * パスワード強度チェックエンドポイント
   * POST /api/auth/check-password-strength
   */
  fastify.post('/check-password-strength', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      
      if (!body || !body.password) {
        return reply.status(400).send({
          success: false,
          error: 'パスワードは必須です'
        });
      }

      const result = calculatePasswordStrength(body.password);
      
      return reply.send({
        success: true,
        strength: result,
        tips: getPasswordTips(),
        example: generatePasswordExample()
      });
    } catch (error) {
      logger.error('Password strength check error', error);
      return reply.status(500).send({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });

  /**
   * パスワード生成のヒント取得エンドポイント
   * GET /api/auth/password-tips
   */
  fastify.get('/password-tips', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        success: true,
        tips: getPasswordTips(),
        example: generatePasswordExample()
      });
    } catch (error) {
      logger.error('Password tips error', error);
      return reply.status(500).send({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });

  /**
   * ユーザー情報取得エンドポイント（認証が必要）
   * GET /api/auth/me
   */
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 認証チェック
      const authResult = await authOperation.authenticateRequest(request, fastify);
      
      if (!authResult.success) {
        return reply.status(401).send({
          success: false,
          error: authResult.error || '認証が必要です'
        });
      }

      return reply.send({
        success: true,
        user: {
          id: authResult.data!._id,
          username: authResult.data!.username,
          createdAt: authResult.data!.createdAt,
          updatedAt: authResult.data!.updatedAt
        }
      });
    } catch (error) {
      logger.error('User info error', error);
      return reply.status(500).send({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });

  /**
   * パスワード変更エンドポイント（認証が必要）
   * PUT /api/auth/change-password
   */
  fastify.put('/change-password', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      
      // 認証チェック
      const authResult = await authOperation.authenticateRequest(request, fastify);
      
      if (!authResult.success) {
        return reply.status(401).send({
          success: false,
          error: authResult.error || '認証が必要です'
        });
      }

      // 入力データチェック
      if (!body || !body.currentPassword || !body.newPassword) {
        return reply.status(400).send({
          success: false,
          error: '現在のパスワードと新しいパスワードは必須です'
        });
      }

      // 現在のパスワード確認
      const verifyResult = await authOperation.verifyPassword(authResult.data!.username, body.currentPassword);
      
      if (!verifyResult.success || !verifyResult.data) {
        return reply.status(400).send({
          success: false,
          error: '現在のパスワードが正しくありません'
        });
      }

      // パスワード更新
      const updateResult = await authOperation.update(authResult.data!._id, {
        password: body.newPassword
      });

      if (!updateResult.success) {
        return reply.status(400).send({
          success: false,
          error: updateResult.error || 'パスワードの更新に失敗しました'
        });
      }

      logger.info('Password changed successfully', { username: authResult.data!.username });

      return reply.send({
        success: true,
        message: 'パスワードが正常に変更されました'
      });
    } catch (error) {
      logger.error('Change password error', error);
      return reply.status(500).send({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });

  /**
   * ユーザー統計取得エンドポイント（管理者用・将来の実装）
   * GET /api/auth/stats
   */
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 認証チェック（将来的に管理者権限チェックを追加）
      const authResult = await authOperation.authenticateRequest(request, fastify);
      
      if (!authResult.success) {
        return reply.status(401).send({
          success: false,
          error: authResult.error || '認証が必要です'
        });
      }

      const stats = await authOperation.getUserStatistics();
      
      if (!stats.success) {
        return reply.status(500).send({
          success: false,
          error: stats.error || '統計の取得に失敗しました'
        });
      }

      return reply.send({
        success: true,
        stats: stats.data
      });
    } catch (error) {
      logger.error('User stats error', error);
      return reply.status(500).send({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });
}

export default authRoutes;
