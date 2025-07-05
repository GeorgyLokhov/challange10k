import os
import json
import asyncio
import queue
import threading
from flask import Flask, request, jsonify
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters
from bot_handlers import BotHandlers
from states import UserStates

app = Flask(__name__)

# Инициализация переменных окружения
TOKEN = os.getenv('TELEGRAM_TOKEN')
WEBHOOK_URL = "https://challange10k.onrender.com/webhook"

# Глобальные переменные
update_queue = queue.Queue()
application = None
bot_loop = None
bot_thread = None

# Инициализация состояний пользователей
user_states = UserStates()

# Инициализация обработчиков бота
bot_handlers = BotHandlers(user_states)

async def setup_application():
    """Настройка приложения Telegram"""
    global application
    
    application = Application.builder().token(TOKEN).build()
    
    # Добавление обработчиков
    application.add_handler(CommandHandler("start", bot_handlers.start))
    application.add_handler(CallbackQueryHandler(bot_handlers.button_handler))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, bot_handlers.message_handler))
    
    # Инициализация приложения
    await application.initialize()
    await application.start()
    
    print("✅ Telegram application initialized")
    return application

async def setup_webhook():
    """Настройка webhook"""
    try:
        bot = Bot(token=TOKEN)
        await bot.initialize()
        result = await bot.set_webhook(url=WEBHOOK_URL)
        await bot.shutdown()
        print(f"✅ Webhook set: {result}")
        return result
    except Exception as e:
        print(f"❌ Error setting webhook: {e}")
        return False

async def process_updates():
    """Основной цикл обработки обновлений"""
    global application, update_queue
    
    print("🚀 Starting update processor...")
    
    while True:
        try:
            # Ждем обновление из очереди
            try:
                update_data = update_queue.get(timeout=1)
            except queue.Empty:
                continue
                
            if update_data is None:  # Сигнал к остановке
                break
                
            # Создаем объект Update
            update = Update.de_json(update_data, application.bot)
            
            # Обрабатываем обновление
            await application.process_update(update)
            
            print(f"✅ Processed update: {update.update_id}")
            
        except Exception as e:
            print(f"❌ Error processing update: {e}")
            
        await asyncio.sleep(0.01)  # Небольшая пауза

def run_bot():
    """Запуск бота в отдельном потоке"""
    global bot_loop
    
    try:
        # Создаем новый event loop для бота
        bot_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(bot_loop)
        
        print("🤖 Starting bot thread...")
        
        # Запускаем все асинхронные операции
        bot_loop.run_until_complete(setup_application())
        bot_loop.run_until_complete(setup_webhook())
        
        # Запускаем основной цикл обработки
        bot_loop.run_until_complete(process_updates())
        
    except Exception as e:
        print(f"❌ Error in bot thread: {e}")
    finally:
        if bot_loop:
            bot_loop.close()

# Flask routes
@app.route('/', methods=['GET'])
def index():
    return "✅ Weekly Report Bot is running!"

@app.route('/webhook', methods=['POST'])
def webhook():
    """Обработка webhook от Telegram"""
    try:
        json_data = request.get_json()
        
        if not json_data:
            print("⚠️ No JSON data received")
            return "No data", 400
        
        # Добавляем обновление в очередь
        update_queue.put(json_data)
        
        print(f"📨 Update queued: {json_data.get('update_id', 'unknown')}")
        return "OK", 200
        
    except Exception as e:
        print(f"❌ Error in webhook: {e}")
        return "Error", 500

@app.route('/status', methods=['GET'])
def status():
    """Проверка статуса бота"""
    return jsonify({
        "status": "running",
        "webhook_url": WEBHOOK_URL,
        "queue_size": update_queue.qsize(),
        "bot_running": bot_thread and bot_thread.is_alive()
    })

@app.route('/health', methods=['GET'])
def health():
    """Health check для Render"""
    return "OK", 200

def start_bot_thread():
    """Запуск бота в отдельном потоке"""
    global bot_thread
    
    bot_thread = threading.Thread(target=run_bot, daemon=True)
    bot_thread.start()
    
    # Ждем немного, чтобы бот успел инициализироваться
    import time
    time.sleep(3)
    
    if bot_thread.is_alive():
        print("✅ Bot thread started successfully")
    else:
        print("❌ Bot thread failed to start")

def shutdown_bot():
    """Остановка бота"""
    global bot_loop, update_queue
    
    print("🛑 Shutting down bot...")
    
    # Сигнал к остановке
    update_queue.put(None)
    
    if bot_loop and not bot_loop.is_closed():
        # Останавливаем приложение
        try:
            asyncio.run_coroutine_threadsafe(application.stop(), bot_loop)
            asyncio.run_coroutine_threadsafe(application.shutdown(), bot_loop)
        except:
            pass

# Обработка сигналов завершения
import signal
import atexit

def signal_handler(signum, frame):
    shutdown_bot()

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)
atexit.register(shutdown_bot)

if __name__ == '__main__':
    print("🚀 Starting Weekly Report Bot...")
    
    # Запускаем бота в отдельном потоке
    start_bot_thread()
    
    # Запуск Flask приложения
    port = int(os.environ.get('PORT', 5000))
    print(f"🌐 Starting Flask server on port {port}")
    
    try:
        app.run(
            host='0.0.0.0', 
            port=port, 
            debug=False, 
            threaded=True,
            use_reloader=False  # Важно! Отключаем reloader
        )
    except KeyboardInterrupt:
        print("🛑 Received shutdown signal")
        shutdown_bot()
