import { Server } from 'socket.io';
import { CustomSocket } from '../types/socket.js';

/**
 * Socket.io に接続している合計接続数（またはルーム単位）を返すレシーバー
 * BaseReceiver を継承せず、最小のイベント登録だけを行う
 */
export class ConnectionsReceiver {
  private io: Server;
  private socket: CustomSocket;
  private readonly eventName = 'getConnections';

  constructor(io: Server, socket: CustomSocket) {
    this.io = io;
    this.socket = socket;
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.socket.on(this.eventName, (data: any, callback?: (response: any) => void) => {
      try {
        const room: string | undefined = data?.room;
        let count = 0;

        if (room) {
          const size = this.io.sockets.adapter.rooms.get(room)?.size;
          count = size ? size : 0;
        } else {
          count = this.io.of('/').sockets.size;
        }

        const response = {
          success: true as const,
          data: {
            count,
            room,
            timestamp: new Date()
          }
        };

        if (callback) callback(response);
      } catch (error) {
        if (callback) {
          callback({ success: false as const, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    });
  }

  public cleanup(): void {
    this.socket.removeAllListeners(this.eventName);
  }
}

export default ConnectionsReceiver;