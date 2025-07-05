import os
import json
from flask import Flask, request
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters
from bot_handlers import BotHandlers
from states import UserStates

app = Flask(__name__)

# Инициализация переменных окружения
TOKEN = os.getenv('TELEGRAM_TOKEN')
SETUP_TOKEN = os.getenv('TELEGRAM_SETUP_TOKEN')

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

@app.route('/', methods=['GET'])
def index():
    return "Weekly Report Bot is running!"

@app.route('/webhook', methods=['POST'])
def webhook():
    try:
        update = Update.de_json(request.get_json(force=True), application.bot)
        application.process_update(update)
        return "OK"
    except Exception as e:
        print(f"Error processing update: {e}")
        return "Error", 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
