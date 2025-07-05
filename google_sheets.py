import os
import json
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
    
    def get_previous_week_tasks(self, week_number: int) -> List[str]:
        """Получить планируемые задачи из предыдущей недели"""
        try:
            if week_number <= 1:
                return []
            
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='A:G'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return []
            
            # Ищем отчет за предыдущую неделю
            prev_week = week_number - 1
            for row in values[1:]:  # Пропускаем заголовок
                if len(row) >= 2 and row[1] == str(prev_week):
                    # Запланированные задачи находятся в колонке F (индекс 5)
                    if len(row) > 5 and row[5]:
                        planned_tasks = row[5].split('\n')
                        return [task.strip() for task in planned_tasks if task.strip()]
            
            return []
        except Exception as e:
            print(f"Error getting previous week tasks: {e}")
            return []
    
    def save_report(self, week_number: int, completed_tasks: List[str], 
                   incomplete_tasks: List[str], planned_tasks: List[str], 
                   comment: str, rating: int) -> bool:
        """Сохранить отчет в Google Sheets"""
        try:
            # Подготовка данных для записи
            date_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            completed_str = '\n'.join(completed_tasks) if completed_tasks else ''
            incomplete_str = '\n'.join(incomplete_tasks) if incomplete_tasks else ''
            planned_str = '\n'.join(planned_tasks) if planned_tasks else ''
            comment_str = comment if comment else ''
            
            # ИСПРАВЛЕННЫЙ порядок данных согласно заголовкам таблицы:
            # A: Дата и время отчёта
            # B: Номер недели  
            # C: Оценка недели
            # D: Сделанные задачи
            # E: Не сделанные задачи
            # F: Запланированные задачи
            # G: Комментарий
            values = [[
                date_str,           # A: Дата и время отчёта
                str(week_number),   # B: Номер недели
                str(rating),        # C: Оценка недели
                completed_str,      # D: Сделанные задачи
                incomplete_str,     # E: Не сделанные задачи
                planned_str,        # F: Запланированные задачи
                comment_str         # G: Комментарий
            ]]
            
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
                if len(row) >= 2 and row[1] == str(week_number):
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
                if len(row) >= 2 and row[1] == str(week_number):
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
