import os
import json
import asyncio
from flask import Flask, request, jsonify
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters
from bot_handlers import BotHandlers
from states import UserStates

app = Flask(__name__)

# Инициализация переменных окружения
TOKEN = os.getenv('TELEGRAM_TOKEN')
WEBHOOK_URL = "https://challange10k.onrender.com/webhook"

# Инициализация состояний пользователей
user_states = UserStates()

# Инициализация обработчиков бота
bot_handlers = BotHandlers(user_states)

# Создание приложения Telegram для webhook
application = Application.builder().token(TOKEN).build()

# Добавление обработчиков
application.add_handler(CommandHandler("start", bot_handlers.start))
application.add_handler(CallbackQueryHandler(bot_handlers.button_handler))
application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, bot_handlers.message_handler))

@app.route('/', methods=['GET'])
def index():
    return "Weekly Report Bot is running!"

@app.route('/webhook', methods=['POST'])
def webhook():
    try:
        # Получаем данные от Telegram
        json_data = request.get_json()
        
        if not json_data:
            return "No data received", 400
            
        # Создаем объект Update
        update = Update.de_json(json_data, application.bot)
        
        # Обрабатываем update асинхронно
        asyncio.run(application.process_update(update))
        
        return "OK", 200
        
    except Exception as e:
        print(f"Error processing webhook: {e}")
        return "Error", 500

@app.route('/set_webhook', methods=['POST'])
def set_webhook():
    """Эндпоинт для установки webhook"""
    try:
        bot = Bot(token=TOKEN)
        asyncio.run(bot.set_webhook(url=WEBHOOK_URL))
        return "Webhook set successfully", 200
    except Exception as e:
        print(f"Error setting webhook: {e}")
        return f"Error: {e}", 500

if __name__ == '__main__':
    # Автоматическая установка webhook при запуске
    try:
        bot = Bot(token=TOKEN)
        print("Setting webhook...")
        asyncio.run(bot.set_webhook(url=WEBHOOK_URL))
        print("Webhook set successfully!")
    except Exception as e:
        print(f"Error setting webhook: {e}")
    
    # Запуск Flask приложения
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
