import os
import json
import asyncio
from flask import Flask, request, jsonify
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters
from bot_handlers import BotHandlers
from states import UserStates
import threading
import time

app = Flask(__name__)

# Инициализация переменных окружения
TOKEN = os.getenv('TELEGRAM_TOKEN')
WEBHOOK_URL = "https://challange10k.onrender.com/webhook"

# Инициализация состояний пользователей
user_states = UserStates()

# Инициализация обработчиков бота
bot_handlers = BotHandlers(user_states)

# Создание приложения Telegram
application = Application.builder().token(TOKEN).build()

# Добавление обработчиков
application.add_handler(CommandHandler("start", bot_handlers.start))
application.add_handler(CallbackQueryHandler(bot_handlers.button_handler))
application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, bot_handlers.message_handler))

# Инициализация приложения
async def init_application():
    await application.initialize()
    await application.start()

# Функция для обработки обновлений в отдельном потоке
def process_update_sync(update_dict):
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        update = Update.de_json(update_dict, application.bot)
        loop.run_until_complete(application.process_update(update))
        loop.close()
        return True
    except Exception as e:
        print(f"Error processing update: {e}")
        return False

@app.route('/', methods=['GET'])
def index():
    return "✅ Weekly Report Bot is running!"

@app.route('/webhook', methods=['POST'])
def webhook():
    try:
        json_data = request.get_json()
        
        if not json_data:
            print("No JSON data received")
            return "No data", 400
        
        # Обрабатываем в отдельном потоке
        thread = threading.Thread(target=process_update_sync, args=(json_data,))
        thread.start()
        
        return "OK", 200
        
    except Exception as e:
        print(f"Error in webhook: {e}")
        return "Error", 500

@app.route('/status', methods=['GET'])
def status():
    return jsonify({
        "status": "running",
        "webhook_url": WEBHOOK_URL,
        "timestamp": time.time()
    })

def setup_webhook():
    """Настройка webhook при запуске"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        bot = Bot(token=TOKEN)
        
        async def set_webhook():
            await bot.initialize()
            result = await bot.set_webhook(url=WEBHOOK_URL)
            await bot.shutdown()
            return result
        
        result = loop.run_until_complete(set_webhook())
        loop.close()
        
        print(f"✅ Webhook setup result: {result}")
        return result
    except Exception as e:
        print(f"❌ Error setting webhook: {e}")
        return False

if __name__ == '__main__':
    print("🚀 Starting Weekly Report Bot...")
    
    # Настройка webhook в отдельном потоке
    webhook_thread = threading.Thread(target=setup_webhook)
    webhook_thread.start()
    
    # Инициализация приложения в отдельном потоке
    def init_app():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(init_application())
    
    init_thread = threading.Thread(target=init_app)
    init_thread.start()
    
    # Даем время на инициализацию
    time.sleep(2)
    
    # Запуск Flask приложения
    port = int(os.environ.get('PORT', 5000))
    print(f"🌐 Starting server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
