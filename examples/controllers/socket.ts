import { Controller, OnConnection, OnMessage, Subscribe } from 'quantum-flow/core';

import { WebSocketEvent } from '../../src/types';

@Controller('socket')
export class Socket {
  /**
   * 1. Приветствие при подключении
   */
  @OnConnection()
  onConnection(event: WebSocketEvent) {
    console.log(`✅ Подключился: ${event.client.id}`);

    // Отправляем приветствие ТОЛЬКО этому клиенту
    event.client.socket.send(
      JSON.stringify({
        type: 'welcome',
        data: { message: 'Добро пожаловать!' },
      }),
    );
  }

  /**
   * 2. @Subscribe - АВТОМАТИЧЕСКАЯ рассылка всем подписчикам
   * Не нужно использовать WebSocketService!
   */
  @Subscribe('chat')
  onChatMessage(event: WebSocketEvent) {
    // Этот метод вызывается для КАЖДОГО подписчика
    // Сообщение УЖЕ автоматически разослано всем!

    const msg = event.message?.data;
    console.log(`💬 Сообщение в chat: ${msg?.text}`);

    // Можно добавить логику, но рассылать НЕ НУЖНО
    if (msg?.text.includes('плохое')) {
      // Если вернуть пустоту - сообщение не уйдет
      return;
    }

    // Всё, сообщение само уйдет подписчикам!
  }

  /**
   * 3. @Subscribe для другой комнаты
   */
  @Subscribe('news')
  onNewsMessage(event: WebSocketEvent) {
    console.log(`📰 Новость: ${event.message?.data.title}`);
    // Автоматическая рассылка всем подписанным на 'news'
  }

  /**
   * 4. @OnMessage для команд (без WebSocketService)
   */
  @OnMessage('ping')
  onPing(event: WebSocketEvent) {
    // Отправляем ответ только этому клиенту
    event.client.socket.send(
      JSON.stringify({
        type: 'pong',
        data: { time: Date.now() },
      }),
    );
  }

  /**
   * 5. @OnMessage для подписки
   */
  @OnMessage('subscribe')
  onSubscribe(event: WebSocketEvent) {
    const topic = event.message?.data.topic;
    console.log(`📌 Клиент ${event.client.id} подписался на ${topic}`);

    // Сервер сам сохранит подписку, ничего делать не нужно!
    // Просто подтверждаем
    event.client.socket.send(
      JSON.stringify({
        type: 'subscribed',
        topic,
        data: { success: true },
      }),
    );
  }
}
