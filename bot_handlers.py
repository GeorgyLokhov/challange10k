import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from states import BotState, UserStates
from google_sheets import GoogleSheetsManager
from utils import format_report_message

class BotHandlers:
    def __init__(self, user_states: UserStates):
        self.user_states = user_states
        self.sheets_manager = GoogleSheetsManager()
        self.sheet_url = "https://docs.google.com/spreadsheets/d/16RGrwyaPaW_FHHyvRS_gyjVaULrq3pWqe5fX7SZQjb8/edit?gid=1682234301#gid=1682234301"
    
    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик команды /start"""
        user_id = update.effective_user.id
        self.user_states.reset_user_data(user_id)
        
        keyboard = [[InlineKeyboardButton("📝 Создать отчёт", callback_data="create_report")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "🤖 Привет! Я помогу создать еженедельный отчёт.\n\n"
            "📊 Нажми кнопку ниже, чтобы начать:",
            reply_markup=reply_markup
        )
    
    async def button_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик нажатий на кнопки"""
        query = update.callback_query
        await query.answer()
        
        user_id = query.from_user.id
        user_data = self.user_states.get_user_data(user_id)
        data = query.data
        
        try:
            if data == "create_report":
                await self._start_report_creation(query, user_id)
            elif data == "back":
                await self._handle_back(query, user_id)
            elif data == "new_report":
                await self._start_report_creation(query, user_id)
            elif data == "delete_report":
                await self._handle_delete_report(query, user_id)
            elif data == "open_sheet":
                await self._handle_open_sheet(query, user_id)
            elif data.startswith("delete_week_"):
                await self._handle_delete_week_selection(query, user_id, data)
            elif data.startswith("confirm_delete_"):
                await self._handle_confirm_delete(query, user_id, data)
            elif data.startswith("rating_"):
                await self._handle_rating_selection(query, user_id, data)
            elif data.startswith("task_"):
                await self._handle_task_selection(query, user_id, data)
            elif data == "add_more_tasks":
                await self._handle_add_more_tasks(query, user_id)
            elif data == "next_step":
                await self._handle_next_step(query, user_id)
            elif data == "edit_task":
                await self._handle_edit_task(query, user_id)
            elif data.startswith("edit_task_"):
                await self._handle_edit_specific_task(query, user_id, data)
            elif data.startswith("priority_"):
                await self._handle_priority_selection(query, user_id, data)
            elif data == "confirm_report":
                await self._handle_confirm_report(query, user_id)
            elif data == "edit_report":
                await self._handle_edit_report(query, user_id)
            elif data.startswith("edit_"):
                await self._handle_edit_section(query, user_id, data)
        except Exception as e:
            print(f"Error in button_handler: {e}")
            await query.edit_message_text("❌ Произошла ошибка. Попробуйте ещё раз.")
    
    async def _handle_back(self, query, user_id):
        """Обработка кнопки Назад"""
        user_data = self.user_states.get_user_data(user_id)
        current_state = user_data.state
        
        if current_state == BotState.WAITING_FOR_RATING:
            await self._start_report_creation(query, user_id)
        elif current_state == BotState.SELECTING_COMPLETED_TASKS:
            await self._handle_rating_selection(query, user_id, f"rating_{user_data.rating}")
        elif current_state == BotState.ADDING_ADDITIONAL_TASKS:
            if user_data.previous_planned_tasks:
                await self._show_completed_tasks_selection(query, user_id)
            else:
                await self._handle_rating_selection(query, user_id, f"rating_{user_data.rating}")
        elif current_state == BotState.ADDING_PLANNED_TASKS:
            self.user_states.set_state(user_id, BotState.ADDING_ADDITIONAL_TASKS)
            keyboard = [[InlineKeyboardButton("⏭️ Пропустить", callback_data="next_step")],
                       [InlineKeyboardButton("◀️ Назад", callback_data="back")]]
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text("➕ Что ещё было сделано? (по одной задаче):", reply_markup=reply_markup)
        elif current_state == BotState.SELECTING_PRIORITY_TASK:
            self.user_states.set_state(user_id, BotState.ADDING_PLANNED_TASKS)
            await query.edit_message_text("🎯 Что запланировано на следующую неделю?")
        elif current_state == BotState.WAITING_FOR_COMMENT:
            if user_data.planned_tasks:
                await self._select_priority_task(query, user_id)
            else:
                self.user_states.set_state(user_id, BotState.ADDING_PLANNED_TASKS)
                await query.edit_message_text("🎯 Что запланировано на следующую неделю?")
        elif current_state == BotState.CONFIRMING_REPORT:
            self.user_states.set_state(user_id, BotState.WAITING_FOR_COMMENT)
            await query.edit_message_text("💬 Добавьте комментарий к отчёту:")
        elif current_state == BotState.DELETING_REPORT:
            await self._show_main_menu(query, user_id)
        elif current_state == BotState.CONFIRMING_DELETE:
            await self._handle_delete_report(query, user_id)
        else:
            await self._show_main_menu(query, user_id)
    
    async def _show_main_menu(self, query, user_id):
        """Показать главное меню"""
        keyboard = [[InlineKeyboardButton("📝 Создать отчёт", callback_data="create_report")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(
            "🤖 Главное меню\n\n📊 Выберите действие:",
            reply_markup=reply_markup
        )
    
    async def _start_report_creation(self, query, user_id):
        """Начать создание отчёта"""
        self.user_states.reset_user_data(user_id)
        self.user_states.set_state(user_id, BotState.WAITING_FOR_WEEK_NUMBER)
        
        keyboard = [[InlineKeyboardButton("◀️ Назад", callback_data="back")]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            "📅 Введите номер недели для отчёта:",
            reply_markup=reply_markup
        )
    
    async def _show_completed_tasks_selection(self, query, user_id):
        """Показать выбор выполненных задач"""
        user_data = self.user_states.get_user_data(user_id)
        
        keyboard = []
        for i, task in enumerate(user_data.previous_planned_tasks):
            status = "✅" if task in user_data.completed_tasks else "❌"
            keyboard.append([InlineKeyboardButton(f"{status} {task}", callback_data=f"task_{i}")])
        keyboard.append([InlineKeyboardButton("➡️ Далее", callback_data="next_step")])
        keyboard.append([InlineKeyboardButton("◀️ Назад", callback_data="back")])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        self.user_states.set_state(user_id, BotState.SELECTING_COMPLETED_TASKS)
        
        await query.edit_message_text(
            f"⭐ Оценка недели: {user_data.rating}/10\n\n"
            "📋 Вот задачи за прошедшую неделю. Нажмите на выполненные:",
            reply_markup=reply_markup
        )
    
    async def _handle_rating_selection(self, query, user_id, data):
        """Обработка выбора оценки"""
        try:
            rating = int(data.split("_")[1])
            user_data = self.user_states.get_user_data(user_id)
            user_data.rating = rating
            
            # Получаем задачи из предыдущей недели
            prev_tasks = await asyncio.get_event_loop().run_in_executor(
                None, self.sheets_manager.get_previous_week_tasks, user_data.week_number
            )
            user_data.previous_planned_tasks = prev_tasks
            
            if prev_tasks:
                await self._show_completed_tasks_selection(query, user_id)
            else:
                self.user_states.set_state(user_id, BotState.ADDING_ADDITIONAL_TASKS)
                keyboard = [
                    [InlineKeyboardButton("⏭️ Пропустить", callback_data="next_step")],
                    [InlineKeyboardButton("◀️ Назад", callback_data="back")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await query.edit_message_text(
                    f"⭐ Оценка недели: {rating}/10\n\n"
                    "📝 Задач за прошлую неделю не найдено.\n"
                    "Напишите, что было сделано на этой неделе:",
                    reply_markup=reply_markup
                )
        except Exception as e:
            print(f"Error in rating selection: {e}")
            await query.edit_message_text("❌ Ошибка при выборе оценки. Попробуйте ещё раз.")
    
    async def _handle_task_selection(self, query, user_id, data):
        """Обработка выбора задач"""
        try:
            task_index = int(data.split("_")[1])
            user_data = self.user_states.get_user_data(user_id)
            
            if task_index < len(user_data.previous_planned_tasks):
                task = user_data.previous_planned_tasks[task_index]
                
                if task in user_data.completed_tasks:
                    user_data.completed_tasks.remove(task)
                    if task not in user_data.incomplete_tasks:
                        user_data.incomplete_tasks.append(task)
                else:
                    if task in user_data.incomplete_tasks:
                        user_data.incomplete_tasks.remove(task)
                    user_data.completed_tasks.append(task)
                
                # Обновляем кнопки
                await self._show_completed_tasks_selection(query, user_id)
        except Exception as e:
            print(f"Error in task selection: {e}")
    
    async def _handle_next_step(self, query, user_id):
        """Переход к следующему шагу"""
        try:
            user_data = self.user_states.get_user_data(user_id)
            
            if user_data.state == BotState.SELECTING_COMPLETED_TASKS:
                self.user_states.set_state(user_id, BotState.ADDING_ADDITIONAL_TASKS)
                keyboard = [
                    [InlineKeyboardButton("⏭️ Пропустить", callback_data="next_step")],
                    [InlineKeyboardButton("◀️ Назад", callback_data="back")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await query.edit_message_text(
                    "➕ Что ещё было сделано? (по одной задаче):",
                    reply_markup=reply_markup
                )
            elif user_data.state == BotState.ADDING_ADDITIONAL_TASKS:
                self.user_states.set_state(user_id, BotState.ADDING_PLANNED_TASKS)
                await query.edit_message_text("🎯 Что запланировано на следующую неделю?")
            elif user_data.state == BotState.ADDING_PLANNED_TASKS:
                if user_data.planned_tasks:
                    await self._select_priority_task(query, user_id)
                else:
                    self.user_states.set_state(user_id, BotState.WAITING_FOR_COMMENT)
                    await query.edit_message_text("💬 Добавьте комментарий к отчёту:")
            elif user_data.state == BotState.SELECTING_PRIORITY_TASK:
                self.user_states.set_state(user_id, BotState.WAITING_FOR_COMMENT)
                await query.edit_message_text("💬 Добавьте комментарий к отчёту:")
        except Exception as e:
            print(f"Error in next step: {e}")
    
    async def _select_priority_task(self, query, user_id):
        """Выбор приоритетной задачи"""
        try:
            user_data = self.user_states.get_user_data(user_id)
            
            keyboard = []
            for i, task in enumerate(user_data.planned_tasks):
                keyboard.append([InlineKeyboardButton(task, callback_data=f"priority_{i}")])
            keyboard.append([InlineKeyboardButton("⏭️ Пропустить", callback_data="next_step")])
            keyboard.append([InlineKeyboardButton("◀️ Назад", callback_data="back")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            self.user_states.set_state(user_id, BotState.SELECTING_PRIORITY_TASK)
            
            await query.edit_message_text(
                "⭐ Выберите приоритетную задачу:",
                reply_markup=reply_markup
            )
        except Exception as e:
            print(f"Error in priority selection: {e}")
    
    async def _handle_priority_selection(self, query, user_id, data):
        """Обработка выбора приоритетной задачи"""
        try:
            task_index = int(data.split("_")[1])
            user_data = self.user_states.get_user_data(user_id)
            
            if task_index < len(user_data.planned_tasks):
                user_data.priority_task = user_data.planned_tasks[task_index]
            
            self.user_states.set_state(user_id, BotState.WAITING_FOR_COMMENT)
            await query.edit_message_text("💬 Добавьте комментарий к отчёту:")
        except Exception as e:
            print(f"Error in priority selection: {e}")
    
    async def _handle_confirm_report(self, query, user_id):
        """Подтверждение отчёта"""
        try:
            user_data = self.user_states.get_user_data(user_id)
            
            # Сохраняем в Google Sheets асинхронно
            success = await asyncio.get_event_loop().run_in_executor(
                None, self.sheets_manager.save_report,
                user_data.week_number, user_data.completed_tasks,
                user_data.incomplete_tasks, user_data.planned_tasks,
                user_data.comment, user_data.rating
            )
            
            if success:
                # Отправляем чистый отчёт
                report_text = format_report_message(user_data)
                await query.edit_message_text(report_text)
                
                # Отправляем отдельное сообщение с кнопками
                keyboard = [
                    [InlineKeyboardButton("📝 Новый отчёт", callback_data="new_report")],
                    [InlineKeyboardButton("🗑️ Удалить отчёт", callback_data="delete_report")],
                    [InlineKeyboardButton("📊 Перейти в таблицу", url=self.sheet_url)]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await query.message.reply_text(
                    "✅ Отчёт успешно сохранён!\n\n"
                    "Выберите следующее действие:",
                    reply_markup=reply_markup
                )
                
                self.user_states.reset_user_data(user_id)
            else:
                await query.edit_message_text("❌ Ошибка сохранения. Попробуйте ещё раз.")
        except Exception as e:
            print(f"Error confirming report: {e}")
            await query.edit_message_text("❌ Ошибка при сохранении отчёта.")
    
    async def _handle_delete_report(self, query, user_id):
        """Обработка удаления отчёта"""
        try:
            # Получаем все номера недель
            week_numbers = await asyncio.get_event_loop().run_in_executor(
                None, self.sheets_manager.get_all_week_numbers
            )
            
            if not week_numbers:
                await query.edit_message_text(
                    "📄 Нет отчётов для удаления.\n\n"
                    "Создайте первый отчёт!",
                    reply_markup=InlineKeyboardMarkup([
                        [InlineKeyboardButton("📝 Создать отчёт", callback_data="create_report")]
                    ])
                )
                return
            
            keyboard = []
            for week_num in week_numbers:
                keyboard.append([InlineKeyboardButton(f"Неделя {week_num}", callback_data=f"delete_week_{week_num}")])
            keyboard.append([InlineKeyboardButton("◀️ Назад", callback_data="back")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            self.user_states.set_state(user_id, BotState.DELETING_REPORT)
            
            await query.edit_message_text(
                "🗑️ Выберите неделю для удаления:",
                reply_markup=reply_markup
            )
        except Exception as e:
            print(f"Error in delete report: {e}")
            await query.edit_message_text("❌ Ошибка при получении списка отчётов.")
    
    async def _handle_delete_week_selection(self, query, user_id, data):
        """Обработка выбора недели для удаления"""
        try:
            week_number = int(data.split("_")[2])
            user_data = self.user_states.get_user_data(user_id)
            user_data.delete_week_number = week_number
            
            keyboard = [
                [InlineKeyboardButton(f"🗑️ Удалить Неделю {week_number}", callback_data=f"confirm_delete_{week_number}")],
                [InlineKeyboardButton("◀️ Назад", callback_data="back")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            self.user_states.set_state(user_id, BotState.CONFIRMING_DELETE)
            
            await query.edit_message_text(
                f"⚠️ Вы уверены, что хотите удалить отчёт за неделю {week_number}?\n\n"
                "Это действие нельзя отменить!",
                reply_markup=reply_markup
            )
        except Exception as e:
            print(f"Error in delete week selection: {e}")
    
    async def _handle_confirm_delete(self, query, user_id, data):
        """Подтверждение удаления"""
        try:
            week_number = int(data.split("_")[2])
            
            # Удаляем отчёт
            success = await asyncio.get_event_loop().run_in_executor(
                None, self.sheets_manager.delete_week_report, week_number
            )
            
            if success:
                keyboard = [
                    [InlineKeyboardButton("📝 Новый отчёт", callback_data="new_report")],
                    [InlineKeyboardButton("🗑️ Удалить ещё отчёт", callback_data="delete_report")],
                    [InlineKeyboardButton("📊 Перейти в таблицу", url=self.sheet_url)]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await query.edit_message_text(
                    f"✅ Отчёт за неделю {week_number} успешно удалён!\n\n"
                    "Выберите следующее действие:",
                    reply_markup=reply_markup
                )
                
                self.user_states.reset_user_data(user_id)
            else:
                await query.edit_message_text(f"❌ Ошибка при удалении отчёта за неделю {week_number}.")
        except Exception as e:
            print(f"Error confirming delete: {e}")
            await query.edit_message_text("❌ Ошибка при удалении отчёта.")
    
    async def _handle_open_sheet(self, query, user_id):
        """Обработка открытия таблицы"""
        await query.edit_message_text(
            f"📊 [Открыть таблицу]({self.sheet_url})",
            parse_mode='Markdown'
        )
    
    async def _handle_edit_report(self, query, user_id):
        """Обработка редактирования отчёта"""
        try:
            keyboard = [
                [InlineKeyboardButton("📅 Номер недели", callback_data="edit_week")],
                [InlineKeyboardButton("⭐ Оценка", callback_data="edit_rating")],
                [InlineKeyboardButton("✅ Выполненные задачи", callback_data="edit_completed")],
                [InlineKeyboardButton("🎯 Планируемые задачи", callback_data="edit_planned")],
                [InlineKeyboardButton("💬 Комментарий", callback_data="edit_comment")],
                [InlineKeyboardButton("◀️ Назад", callback_data="back")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await query.edit_message_text(
                "✏️ Что хотите изменить?",
                reply_markup=reply_markup
            )
        except Exception as e:
            print(f"Error in edit report: {e}")
    
    async def _handle_add_more_tasks(self, query, user_id):
        """Добавление дополнительных задач"""
        await query.edit_message_text("➕ Напишите следующую выполненную задачу:")
    
    async def _handle_edit_task(self, query, user_id):
        """Редактирование задач"""
        try:
            user_data = self.user_states.get_user_data(user_id)
            
            if not user_data.planned_tasks:
                await query.edit_message_text("📝 Нет задач для редактирования.")
                return
            
            keyboard = []
            for i, task in enumerate(user_data.planned_tasks):
                keyboard.append([InlineKeyboardButton(task, callback_data=f"edit_task_{i}")])
            keyboard.append([InlineKeyboardButton("◀️ Назад", callback_data="back")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            await query.edit_message_text(
                "✏️ Выберите задачу для редактирования:",
                reply_markup=reply_markup
            )
        except Exception as e:
            print(f"Error in edit task: {e}")
    
    async def _handle_edit_specific_task(self, query, user_id, data):
        """Редактирование конкретной задачи"""
        try:
            task_index = int(data.split("_")[2])
            user_data = self.user_states.get_user_data(user_id)
            
            if task_index < len(user_data.planned_tasks):
                user_data.editing_task_index = task_index
                self.user_states.set_state(user_id, BotState.EDITING_TASK)
                
                await query.edit_message_text(
                    f"✏️ Текущая задача: {user_data.planned_tasks[task_index]}\n\n"
                    "Напишите новый текст задачи:"
                )
        except Exception as e:
            print(f"Error in edit specific task: {e}")
    
    async def _handle_edit_section(self, query, user_id, data):
        """Редактирование секции отчёта"""
        try:
            section = data.split("_")[1]
            
            if section == "week":
                self.user_states.set_state(user_id, BotState.WAITING_FOR_WEEK_NUMBER)
                keyboard = [[InlineKeyboardButton("◀️ Назад", callback_data="back")]]
                reply_markup = InlineKeyboardMarkup(keyboard)
                await query.edit_message_text("📅 Введите новый номер недели:", reply_markup=reply_markup)
            elif section == "rating":
                keyboard = []
                row = []
                for i in range(1, 11):
                    row.append(InlineKeyboardButton(str(i), callback_data=f"rating_{i}"))
                    if len(row) == 5:
                        keyboard.append(row)
                        row = []
                if row:
                    keyboard.append(row)
                keyboard.append([InlineKeyboardButton("◀️ Назад", callback_data="back")])
                reply_markup = InlineKeyboardMarkup(keyboard)
                await query.edit_message_text("⭐ Выберите новую оценку:", reply_markup=reply_markup)
            elif section == "comment":
                self.user_states.set_state(user_id, BotState.WAITING_FOR_COMMENT)
                await query.edit_message_text("💬 Введите новый комментарий:")
        except Exception as e:
            print(f"Error in edit section: {e}")
    
    async def message_handler(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработчик текстовых сообщений"""
        try:
            user_id = update.effective_user.id
            user_data = self.user_states.get_user_data(user_id)
            text = update.message.text.strip()
            
            if user_data.state == BotState.WAITING_FOR_WEEK_NUMBER:
                await self._handle_week_number(update, user_id, text)
            elif user_data.state == BotState.ADDING_ADDITIONAL_TASKS:
                await self._handle_additional_task(update, user_id, text)
            elif user_data.state == BotState.ADDING_PLANNED_TASKS:
                await self._handle_planned_task(update, user_id, text)
            elif user_data.state == BotState.WAITING_FOR_COMMENT:
                await self._handle_comment(update, user_id, text)
            elif user_data.state == BotState.EDITING_TASK:
                await self._handle_task_edit(update, user_id, text)
            else:
                await update.message.reply_text("👋 Нажмите /start для начала работы!")
        except Exception as e:
            print(f"Error in message handler: {e}")
            await update.message.reply_text("❌ Произошла ошибка. Попробуйте ещё раз.")
    
    async def _handle_week_number(self, update, user_id, text):
        """Обработка номера недели"""
        try:
            week_number = int(text)
            if week_number <= 0:
                await update.message.reply_text("⚠️ Номер недели должен быть больше 0.")
                return
            
            user_data = self.user_states.get_user_data(user_id)
            user_data.week_number = week_number
            
            keyboard = []
            row = []
            for i in range(1, 11):
                row.append(InlineKeyboardButton(str(i), callback_data=f"rating_{i}"))
                if len(row) == 5:
                    keyboard.append(row)
                    row = []
            if row:
                keyboard.append(row)
            keyboard.append([InlineKeyboardButton("◀️ Назад", callback_data="back")])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            self.user_states.set_state(user_id, BotState.WAITING_FOR_RATING)
            
            await update.message.reply_text(
                f"📅 Неделя {week_number}\n\n⭐ Оцените неделю от 1 до 10:",
                reply_markup=reply_markup
            )
        except ValueError:
            await update.message.reply_text("⚠️ Введите корректный номер недели (число).")
        except Exception as e:
            print(f"Error in week number handler: {e}")
    
    async def _handle_additional_task(self, update, user_id, text):
        """Обработка дополнительных задач"""
        try:
            user_data = self.user_states.get_user_data(user_id)
            user_data.completed_tasks.append(text)
            
            keyboard = [
                [InlineKeyboardButton("➕ Добавить ещё", callback_data="add_more_tasks")],
                [InlineKeyboardButton("➡️ Далее", callback_data="next_step")],
                [InlineKeyboardButton("◀️ Назад", callback_data="back")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                f"✅ Задача добавлена: {text}\n\n➕ Что дальше?",
                reply_markup=reply_markup
            )
        except Exception as e:
            print(f"Error in additional task handler: {e}")
    
    async def _handle_planned_task(self, update, user_id, text):
        """Обработка запланированных задач"""
        try:
            user_data = self.user_states.get_user_data(user_id)
            user_data.planned_tasks.append(text)
            
            keyboard = [
                [InlineKeyboardButton("➡️ Далее", callback_data="next_step")],
                [InlineKeyboardButton("✏️ Изменить задачу", callback_data="edit_task")],
                [InlineKeyboardButton("◀️ Назад", callback_data="back")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                f"📝 Задача добавлена: {text}\n\n🎯 Что дальше?",
                reply_markup=reply_markup
            )
        except Exception as e:
            print(f"Error in planned task handler: {e}")
    
    async def _handle_comment(self, update, user_id, text):
        """Обработка комментария"""
        try:
            user_data = self.user_states.get_user_data(user_id)
            user_data.comment = text
            
            report_preview = format_report_message(user_data)
            
            keyboard = [
                [InlineKeyboardButton("✅ Подтвердить", callback_data="confirm_report")],
                [InlineKeyboardButton("✏️ Изменить", callback_data="edit_report")],
                [InlineKeyboardButton("◀️ Назад", callback_data="back")]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            self.user_states.set_state(user_id, BotState.CONFIRMING_REPORT)
            
            await update.message.reply_text(
                f"📊 Предварительный отчёт:\n\n{report_preview}\n\n✅ Подтвердить?",
                reply_markup=reply_markup
            )
        except Exception as e:
            print(f"Error in comment handler: {e}")
    
    async def _handle_task_edit(self, update, user_id, text):
        """Обработка редактирования задачи"""
        try:
            user_data = self.user_states.get_user_data(user_id)
            
            if user_data.editing_task_index is not None:
                user_data.planned_tasks[user_data.editing_task_index] = text
                user_data.editing_task_index = None
                
                self.user_states.set_state(user_id, BotState.ADDING_PLANNED_TASKS)
                
                keyboard = [
                    [InlineKeyboardButton("➡️ Далее", callback_data="next_step")],
                    [InlineKeyboardButton("✏️ Изменить задачу", callback_data="edit_task")],
                    [InlineKeyboardButton("◀️ Назад", callback_data="back")]
                ]
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await update.message.reply_text(
                    f"✅ Задача изменена: {text}\n\n🎯 Что дальше?",
                    reply_markup=reply_markup
                )
        except Exception as e:
            print(f"Error in task edit handler: {e}")
