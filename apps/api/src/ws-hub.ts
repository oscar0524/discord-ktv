import type { WebSocket, WebSocketServer } from 'ws';
import type { ServerMessage } from '@discord-ktv/shared-types';

/**
 * WebSocketHub 管理所有連線的前端，負責把事件廣播出去。
 * 抽成獨立類別以便對「廣播邏輯」做單元測試（可注入假的 client 集合）。
 */
export class WebSocketHub {
  private readonly clients = new Set<WebSocket>();

  /** 註冊一條連線，並在關閉時自動移除 */
  add(socket: WebSocket): void {
    this.clients.add(socket);
    socket.on('close', () => this.clients.delete(socket));
  }

  /** 目前連線數 */
  get size(): number {
    return this.clients.size;
  }

  /** 廣播一則訊息給所有 OPEN 狀態的連線 */
  broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      // ws.OPEN === 1；避免 import 具體常數以利測試注入假物件
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  /** 綁定到一個 WebSocketServer，自動接收新連線 */
  attach(wss: WebSocketServer): void {
    wss.on('connection', (socket: WebSocket) => this.add(socket));
  }
}
