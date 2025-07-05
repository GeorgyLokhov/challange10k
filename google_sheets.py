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
                range='A:F'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return []
            
            # Ищем отчет за предыдущую неделю
            prev_week = week_number - 1
            for row in values[1:]:  # Пропускаем заголовок
                if len(row) >= 6 and row[1] == str(prev_week):
                    planned_tasks = row[4].split('\n') if len(row) > 4 and row[4] else []
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
            completed_str = '\n'.join(completed_tasks)
            incomplete_str = '\n'.join(incomplete_tasks)
            planned_str = '\n'.join(planned_tasks)
            
            values = [[
                date_str,
                str(week_number),
                completed_str,
                incomplete_str,
                planned_str,
                comment,
                str(rating)
            ]]
            
            # Проверяем, есть ли заголовки
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='A1:G1'
            ).execute()
            
            if not result.get('values'):
                # Добавляем заголовки
                headers = [['Дата отчёта', 'Номер недели', 'Сделанные задачи', 
                          'Не сделанные задачи', 'Планируемые задачи', 'Комментарий', 'Оценка']]
                self.sheet.values().update(
                    spreadsheetId=self.sheet_id,
                    range='A1:G1',
                    valueInputOption='USER_ENTERED',
                    body={'values': headers}
                ).execute()
            
            # Добавляем данные
            self.sheet.values().append(
                spreadsheetId=self.sheet_id,
                range='A:G',
                valueInputOption='USER_ENTERED',
                insertDataOption='INSERT_ROWS',
                body={'values': values}
            ).execute()
            
            return True
        except Exception as e:
            print(f"Error saving report: {e}")
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
