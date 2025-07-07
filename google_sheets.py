import os
import json
import re
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from typing import List, Dict, Optional

class GoogleSheetsManager:
    def __init__(self):
        self.credentials = self._get_credentials()
        self.sheet_id = os.getenv('GOOGLE_SHEET_ID')
        self.service = build('sheets', 'v4', credentials=self.credentials)
        self.sheet = self.service.spreadsheets()
    
    def _get_credentials(self):
        creds_json = os.getenv('GOOGLE_CREDENTIALS')
        if not creds_json:
            raise ValueError("GOOGLE_CREDENTIALS environment variable not set")
        
        creds_dict = json.loads(creds_json)
        return Credentials.from_service_account_info(creds_dict)
    
    def _format_date_russian(self, dt):
        """Форматирование даты в русском формате"""
        months = [
            "января", "февраля", "марта", "апреля", "мая", "июня",
            "июля", "августа", "сентября", "октября", "ноября", "декабря"
        ]
        day = dt.day
        month = months[dt.month - 1]
        year = dt.year
        time = dt.strftime('%H:%M')
        return f"{day} {month} {year}, {time}"
    
    def _clean_week_number(self, week_str: str) -> str:
        """Очистка номера недели от лишних символов"""
        if not week_str:
            return ""
        # Убираем все нечисловые символы (пробелы, точки и т.д.)
        return re.sub(r"[^0-9]", "", str(week_str))
    
    def _safe_get_cell(self, row: List[str], index: int) -> str:
        """Безопасное получение ячейки из строки"""
        try:
            if index < len(row):
                return row[index] if row[index] is not None else ""
            return ""
        except (IndexError, TypeError):
            return ""
    
    def get_previous_week_tasks(self, week_number: int) -> List[str]:
        """Получить планируемые задачи из предыдущей недели"""
        try:
            print(f"🔍 Ищем задачи для недели {week_number}, предыдущая неделя: {week_number - 1}")
            
            if week_number <= 1:
                print("⚠️ Неделя <= 1, возвращаем пустой список")
                return []
            
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='A:G'
            ).execute()
            
            values = result.get('values', [])
            print(f"📊 Получено строк из таблицы: {len(values)}")
            
            if not values:
                print("❌ Таблица пустая")
                return []
            
            # Показываем заголовки для отладки
            if len(values) > 0:
                print(f"📋 Заголовки: {values[0]}")
            
            prev_week = week_number - 1
            print(f"🎯 Ищем неделю: '{prev_week}'")
            
            # Ищем отчет за предыдущую неделю
            for i, row in enumerate(values[1:], 1):  # Пропускаем заголовок
                # Безопасно получаем номер недели
                week_cell = self._safe_get_cell(row, 1)  # Колонка B (индекс 1)
                cleaned_week = self._clean_week_number(week_cell)
                
                print(f"📄 Строка {i}: длина={len(row)}, неделя='{week_cell}' -> очищенная='{cleaned_week}'")
                
                if cleaned_week == str(prev_week):
                    print(f"✅ Найдена строка для недели {prev_week}")
                    
                    # Безопасно получаем запланированные задачи из колонки F (индекс 5)
                    planned_tasks_cell = self._safe_get_cell(row, 5)
                    print(f"📝 Колонка F (запланированные задачи): '{planned_tasks_cell}'")
                    
                    if planned_tasks_cell:
                        # Разделяем задачи по переносам строки
                        planned_tasks = planned_tasks_cell.split('\n')
                        clean_tasks = [task.strip() for task in planned_tasks if task.strip()]
                        print(f"🎯 Найденные задачи: {clean_tasks}")
                        return clean_tasks
                    else:
                        print("❌ Колонка F пустая")
            
            print(f"❌ Не найдено строки для недели {prev_week}")
            return []
            
        except Exception as e:
            print(f"💥 Ошибка при получении задач: {e}")
            return []
    
    def get_all_week_numbers(self) -> List[int]:
        """Получить все номера недель из таблицы"""
        try:
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='B:B'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return []
            
            week_numbers = []
            for row in values[1:]:  # Пропускаем заголовок
                week_cell = self._safe_get_cell(row, 0)
                cleaned_week = self._clean_week_number(week_cell)
                
                if cleaned_week and cleaned_week.isdigit():
                    week_numbers.append(int(cleaned_week))
            
            return sorted(list(set(week_numbers)))  # Убираем дубликаты и сортируем
        except Exception as e:
            print(f"Error getting week numbers: {e}")
            return []
    
    def delete_week_report(self, week_number: int) -> bool:
        """Удалить отчет за указанную неделю"""
        try:
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='A:G'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return False
            
            # Находим строку с отчетом за указанную неделю
            for i, row in enumerate(values[1:], start=2):  # Начинаем с строки 2
                week_cell = self._safe_get_cell(row, 1)
                cleaned_week = self._clean_week_number(week_cell)
                
                if cleaned_week == str(week_number):
                    # Удаляем строку
                    request = {
                        'requests': [
                            {
                                'deleteDimension': {
                                    'range': {
                                        'sheetId': 0,
                                        'dimension': 'ROWS',
                                        'startIndex': i - 1,
                                        'endIndex': i
                                    }
                                }
                            }
                        ]
                    }
                    
                    self.service.spreadsheets().batchUpdate(
                        spreadsheetId=self.sheet_id,
                        body=request
                    ).execute()
                    
                    print(f"✅ Deleted report for week {week_number}")
                    return True
            
            return False
        except Exception as e:
            print(f"Error deleting week report: {e}")
            return False
    
    def save_report(self, week_number: int, completed_tasks: List[str], 
                   incomplete_tasks: List[str], planned_tasks: List[str], 
                   comment: str, rating: int) -> bool:
        """Сохранить отчет в Google Sheets"""
        try:
            # Подготовка данных для записи с русским форматом даты
            date_str = self._format_date_russian(datetime.now())
            completed_str = '\n'.join(completed_tasks) if completed_tasks else ''
            incomplete_str = '\n'.join(incomplete_tasks) if incomplete_tasks else ''
            planned_str = '\n'.join(planned_tasks) if planned_tasks else ''
            comment_str = comment if comment else ''
            
            # Порядок данных согласно заголовкам таблицы:
            # A: Дата и время отчёта
            # B: Номер недели  
            # C: Оценка недели
            # D: Сделанные задачи
            # E: Не сделанные задачи
            # F: Запланированные задачи
            # G: Комментарий
            values = [[
                date_str,           # A: Дата и время отчёта (русский формат)
                str(week_number),   # B: Номер недели
                str(rating),        # C: Оценка недели
                completed_str,      # D: Сделанные задачи
                incomplete_str,     # E: Не сделанные задачи
                planned_str,        # F: Запланированные задачи
                comment_str         # G: Комментарий
            ]]
            
            print(f"📅 Saving report with date: {date_str}")
            
            # Проверяем, есть ли заголовки
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='A1:G1'
            ).execute()
            
            if not result.get('values'):
                # Добавляем заголовки
                headers = [['Дата и время отчёта', 'Номер недели', 'Оценка недели', 
                          'Сделанные задачи', 'Не сделанные задачи', 'Запланированные задачи', 'Комментарий']]
                self.sheet.values().update(
                    spreadsheetId=self.sheet_id,
                    range='A1:G1',
                    valueInputOption='USER_ENTERED',
                    body={'values': headers}
                ).execute()
                print("✅ Headers added to sheet")
            
            # Проверяем, есть ли уже отчет за эту неделю
            if self.check_week_exists(week_number):
                # Обновляем существующий отчет
                self._update_existing_report(week_number, values[0])
                print(f"✅ Updated report for week {week_number}")
            else:
                # Добавляем новый отчет
                self.sheet.values().append(
                    spreadsheetId=self.sheet_id,
                    range='A:G',
                    valueInputOption='USER_ENTERED',
                    insertDataOption='INSERT_ROWS',
                    body={'values': values}
                ).execute()
                print(f"✅ Added new report for week {week_number}")
            
            return True
        except Exception as e:
            print(f"Error saving report: {e}")
            return False
    
    def _update_existing_report(self, week_number: int, new_data: List[str]) -> bool:
        """Обновить существующий отчет"""
        try:
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='A:G'
            ).execute()
            
            values = result.get('values', [])
            
            # Находим строку с отчетом за указанную неделю
            for i, row in enumerate(values[1:], start=2):  # Начинаем с строки 2
                week_cell = self._safe_get_cell(row, 1)
                cleaned_week = self._clean_week_number(week_cell)
                
                if cleaned_week == str(week_number):
                    # Обновляем строку
                    range_name = f'A{i}:G{i}'
                    self.sheet.values().update(
                        spreadsheetId=self.sheet_id,
                        range=range_name,
                        valueInputOption='USER_ENTERED',
                        body={'values': [new_data]}
                    ).execute()
                    return True
            
            return False
        except Exception as e:
            print(f"Error updating existing report: {e}")
            return False
    
    def check_week_exists(self, week_number: int) -> bool:
        """Проверить, существует ли уже отчет за эту неделю"""
        try:
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='A:B'
            ).execute()
            
            values = result.get('values', [])
            for row in values[1:]:  # Пропускаем заголовок
                week_cell = self._safe_get_cell(row, 1)
                cleaned_week = self._clean_week_number(week_cell)
                
                if cleaned_week == str(week_number):
                    return True
            return False
        except Exception as e:
            print(f"Error checking week existence: {e}")
            return False
    
    def clear_sheet(self) -> bool:
        """Очистить все данные (кроме заголовков) - для отладки"""
        try:
            # Очищаем все данные начиная со второй строки
            self.sheet.values().clear(
                spreadsheetId=self.sheet_id,
                range='A2:G1000'
            ).execute()
            print("✅ Sheet cleared")
            return True
        except Exception as e:
            print(f"Error clearing sheet: {e}")
            return False
