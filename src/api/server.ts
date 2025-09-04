import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { serverOperation } from '../operations/serverOperation.js';
import { createLogger, LogCategory } from '../utils/consoleLog.js';

const logger = createLogger(LogCategory.SYSTEM, 'ServerAPI');

/**
 * サーバー設定に関するAPIエンドポイント
 * Fastifyプラグインとして実装
 */
export async function serverRoutes(fastify: FastifyInstance) {
  /**
   * サーバー作成（シングルトン）
   * POST /api/server
   */
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      logger.info('Create server request received');

      const result = await serverOperation.create({
        name: body?.name,
        description: body?.description,
        logo: body?.logo,
        language: body?.language,
        categories: body?.categories,
        settings: body?.max_members ? {
          is_private: body?.is_private || false,
          max_members: body?.max_members
        } : undefined
      });

      if (!result.success) {
        const status = result.error?.includes('already exists') ? 409 : 400;
        return reply.status(status).send({ success: false, error: result.error, errors: result.errors });
      }

      return reply.send({ success: true, server: result.data });
    } catch (error) {
      logger.error('Create server error', error);
      return reply.status(500).send({ success: false, error: 'サーバーエラーが発生しました' });
    }
  });

  /**
   * サーバー取得
   * GET /api/server
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await serverOperation.get();
      if (!result.success) {
        return reply.status(404).send({ success: false, error: result.error });
      }
      return reply.send({ success: true, server: result.data });
    } catch (error) {
      logger.error('Get server error', error);
      return reply.status(500).send({ success: false, error: 'サーバーエラーが発生しました' });
    }
  });

  /**
   * サーバー更新
   * PUT /api/server
   */
  fastify.put('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      logger.info('Update server request received');

      const result = await serverOperation.update({
        name: body?.name,
        description: body?.description,
        logo: body?.logo,
        language: body?.language,
        categories: body?.categories,
        settings: body?.max_members ? {
          is_private: body?.is_private,
          max_members: body?.max_members
        } : undefined
      });

      if (!result.success) {
        const status = result.error === 'Server not found' ? 404 : 400;
        return reply.status(status).send({ success: false, error: result.error, errors: result.errors });
      }

      return reply.send({ success: true, server: result.data });
    } catch (error) {
      logger.error('Update server error', error);
      return reply.status(500).send({ success: false, error: 'サーバーエラーが発生しました' });
    }
  });

  /**
   * サーバー削除（開発用）
   * DELETE /api/server
   */
  fastify.delete('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await serverOperation.delete();
      if (!result.success) {
        return reply.status(404).send({ success: false, error: result.error });
      }
      return reply.send({ success: true, server: result.data });
    } catch (error) {
      logger.error('Delete server error', error);
      return reply.status(500).send({ success: false, error: 'サーバーエラーが発生しました' });
    }
  });

  /**
   * カテゴリを追加
   * GET /api/server/categories
   */
  fastify.post('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const body = request.body as any;
        const result = await serverOperation.addCategory(body.categories as string[]);
        if (!result.success) {
        return reply.status(400).send({ success: false, error: result.error });
        }
        return reply.send({ success: true, server: result.data });
    } catch (error) {
        logger.error('Add category error', error);
        return reply.status(500).send({ success: false, error: 'サーバーエラーが発生しました' });
    }
    });
}

export default serverRoutes;
