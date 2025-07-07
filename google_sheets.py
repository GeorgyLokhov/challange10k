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
        cleaned = re.sub(r"[^0-9]", "", str(week_str))
        print(f"🧹 _clean_week_number: '{week_str}' -> '{cleaned}' (длина: {len(week_str)} -> {len(cleaned)})")
        return cleaned
    
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
        debug_info = {
            'total_checks': 0,
            'week_found': False,
            'data_found': False,
            'rows_analyzed': 0,
            'exact_matches': [],
            'close_matches': [],
            'all_weeks_found': [],
            'errors': []
        }
        
        try:
            print(f"🔍 [ДИАГНОСТИКА] Ищем задачи для недели {week_number}, предыдущая неделя: {week_number - 1}")
            debug_info['target_week'] = week_number - 1
            debug_info['total_checks'] += 1
            
            if week_number <= 1:
                debug_info['errors'].append("Неделя <= 1")
                print("⚠️ [ДИАГНОСТИКА] Неделя <= 1, возвращаем пустой список")
                self._save_debug_info(debug_info)
                return []
            
            # Специфичный запрос к листу WeeklyReports
            range_name = 'WeeklyReports!A:G'
            print(f"📊 [ДИАГНОСТИКА] Запрашиваем данные из диапазона: {range_name}")
            
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range=range_name
            ).execute()
            debug_info['total_checks'] += 1
            
            values = result.get('values', [])
            debug_info['rows_total'] = len(values)
            print(f"📊 [ДИАГНОСТИКА] Получено строк из таблицы: {len(values)}")
            
            if not values:
                debug_info['errors'].append("Таблица пустая")
                print("❌ [ДИАГНОСТИКА] Таблица пустая")
                self._save_debug_info(debug_info)
                return []
            
            # Показываем заголовки для отладки
            if len(values) > 0:
                debug_info['headers'] = values[0]
                print(f"📋 [ДИАГНОСТИКА] Заголовки: {values[0]}")
                # Проверяем правильность заголовков
                expected_headers = ['Дата и время отчёта', 'Номер недели', 'Оценка недели', 'Сделанные задачи', 'Не сделанные задачи', 'Запланированные задачи', 'Комментарий']
                if len(values[0]) >= 6:
                    print(f"📋 [ДИАГНОСТИКА] Колонка F (индекс 5): '{values[0][5] if len(values[0]) > 5 else 'ОТСУТСТВУЕТ'}'")
            
            prev_week = week_number - 1
            print(f"🎯 [ДИАГНОСТИКА] Ищем неделю: '{prev_week}'")
            
            # Показываем все данные для диагностики
            print(f"🔍 [ДИАГНОСТИКА] Всего строк для анализа: {len(values) - 1}")
            debug_info['rows_analyzed'] = len(values) - 1
            
            # ПЕРВЫЙ ПРОХОД: Собираем все номера недель для анализа
            print(f"🔍 [ДИАГНОСТИКА] === ПЕРВЫЙ ПРОХОД: Анализ всех недель в таблице ===")
            for i, row in enumerate(values[1:], 1):
                week_cell = self._safe_get_cell(row, 1)
                cleaned_week = self._clean_week_number(week_cell)
                if cleaned_week:
                    debug_info['all_weeks_found'].append({
                        'row': i,
                        'original': week_cell,
                        'cleaned': cleaned_week,
                        'as_int': int(cleaned_week) if cleaned_week.isdigit() else None
                    })
            
            print(f"🔍 [ДИАГНОСТИКА] Найдены следующие недели в таблице:")
            for week_info in debug_info['all_weeks_found']:
                print(f"   Строка {week_info['row']}: '{week_info['original']}' -> '{week_info['cleaned']}' -> {week_info['as_int']}")
            
            # ВТОРОЙ ПРОХОД: Детальный поиск нужной недели
            print(f"🔍 [ДИАГНОСТИКА] === ВТОРОЙ ПРОХОД: Поиск недели {prev_week} ===")
            
            for i, row in enumerate(values[1:], 1):  # Пропускаем заголовок
                debug_info['total_checks'] += 1
                
                # Безопасно получаем номер недели
                week_cell = self._safe_get_cell(row, 1)  # Колонка B (индекс 1)
                cleaned_week = self._clean_week_number(week_cell)
                
                # Показываем содержимое всей строки для диагностики
                print(f"📄 [ДИАГНОСТИКА] Строка {i}: {row}")
                print(f"   Неделя RAW: '{week_cell}' (длина: {len(week_cell)}, тип: {type(week_cell)})")
                print(f"   Неделя CLEAN: '{cleaned_week}' (длина: {len(cleaned_week)})")
                print(f"   Ищем: '{prev_week}' (тип: {type(prev_week)})")
                
                # Множественные варианты сравнения
                string_match = cleaned_week == str(prev_week)
                int_match = cleaned_week.isdigit() and int(cleaned_week) == prev_week
                contains_match = str(prev_week) in cleaned_week
                
                print(f"   Проверки: string_match={string_match}, int_match={int_match}, contains_match={contains_match}")
                
                # Сохраняем близкие совпадения
                if contains_match or abs(int(cleaned_week) - prev_week) <= 1 if cleaned_week.isdigit() else False:
                    debug_info['close_matches'].append({
                        'row': i,
                        'week_cell': week_cell,
                        'cleaned': cleaned_week,
                        'row_data': row[:6]  # Первые 6 колонок
                    })
                
                # Улучшенное сравнение
                week_matches = string_match or int_match
                
                if week_matches:
                    debug_info['week_found'] = True
                    debug_info['exact_matches'].append({'row': i, 'data': row})
                    print(f"✅ [ДИАГНОСТИКА] НАЙДЕНА СТРОКА для недели {prev_week}!")
                    
                    # Безопасно получаем запланированные задачи из колонки F (индекс 5)
                    planned_tasks_cell = self._safe_get_cell(row, 5)
                    print(f"📝 [ДИАГНОСТИКА] Колонка F (индекс 5, запланированные задачи):")
                    print(f"   RAW: '{planned_tasks_cell}'")
                    print(f"   Длина: {len(planned_tasks_cell)}")
                    print(f"   Тип: {type(planned_tasks_cell)}")
                    print(f"   После strip(): '{planned_tasks_cell.strip()}'")
                    print(f"   Булево значение: {bool(planned_tasks_cell and planned_tasks_cell.strip())}")
                    
                    if planned_tasks_cell and planned_tasks_cell.strip():
                        debug_info['data_found'] = True
                        # Разделяем задачи по переносам строки
                        planned_tasks = planned_tasks_cell.split('\n')
                        clean_tasks = [task.strip() for task in planned_tasks if task.strip()]
                        print(f"🎯 [ДИАГНОСТИКА] УСПЕХ! Найденные задачи: {clean_tasks}")
                        debug_info['found_tasks'] = clean_tasks
                        self._save_debug_info(debug_info)
                        return clean_tasks
                    else:
                        debug_info['errors'].append(f"Колонка F пустая в строке {i}")
                        print("❌ [ДИАГНОСТИКА] Колонка F пустая или содержит только пробелы")
            
            # Финальная диагностика
            print(f"❌ [ДИАГНОСТИКА] === ФИНАЛЬНЫЙ РЕЗУЛЬТАТ ===")
            print(f"   Искали неделю: {prev_week}")
            print(f"   Всего проверок: {debug_info['total_checks']}")
            print(f"   Строк проанализировано: {debug_info['rows_analyzed']}")
            print(f"   Неделя найдена: {debug_info['week_found']}")
            print(f"   Данные найдены: {debug_info['data_found']}")
            print(f"   Точные совпадения: {len(debug_info['exact_matches'])}")
            print(f"   Близкие совпадения: {len(debug_info['close_matches'])}")
            
            if debug_info['close_matches']:
                print(f"🔍 [ДИАГНОСТИКА] Близкие совпадения (возможные проблемы форматирования):")
                for match in debug_info['close_matches']:
                    print(f"   Строка {match['row']}: '{match['week_cell']}' -> '{match['cleaned']}'")
            
            self._save_debug_info(debug_info)
            return []
            
        except Exception as e:
            debug_info['errors'].append(f"Exception: {str(e)}")
            print(f"💥 [ДИАГНОСТИКА] Ошибка при получении задач: {e}")
            self._save_debug_info(debug_info)
            return []
    
    def _save_debug_info(self, debug_info):
        """Сохранить диагностическую информацию для отображения пользователю"""
        # Сохраняем в переменную класса для доступа из других методов
        self.last_debug_info = debug_info
        print(f"💾 [ДИАГНОСТИКА] Информация сохранена: {len(debug_info)} ключей")
    
    def get_last_debug_summary(self) -> str:
        """Получить краткую сводку последней диагностики"""
        if not hasattr(self, 'last_debug_info'):
            return "Диагностика не выполнялась"
        
        info = self.last_debug_info
        summary = f"""
🔍 **ДИАГНОСТИКА ПОИСКА ЗАДАЧ:**
• Проверок выполнено: {info.get('total_checks', 0)}
• Строк проанализировано: {info.get('rows_analyzed', 0)}
• Неделя найдена: {'✅ ДА' if info.get('week_found') else '❌ НЕТ'}
• Данные найдены: {'✅ ДА' if info.get('data_found') else '❌ НЕТ'}
• Точных совпадений: {len(info.get('exact_matches', []))}
• Близких совпадений: {len(info.get('close_matches', []))}
• Всего недель в таблице: {len(info.get('all_weeks_found', []))}
• Ошибок: {len(info.get('errors', []))}

📋 **НАЙДЕННЫЕ НЕДЕЛИ:** {[w['as_int'] for w in info.get('all_weeks_found', []) if w['as_int']]}
"""
        
        if info.get('errors'):
            summary += f"\n⚠️ **ОШИБКИ:** {', '.join(info.get('errors', []))}"
        
        return summary.strip()
    
    def get_all_week_numbers(self) -> List[int]:
        """Получить все номера недель из таблицы"""
        try:
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='WeeklyReports!B:B'
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
            print(f"🗑️ [УДАЛЕНИЕ] Удаляем отчет за неделю {week_number}")
            
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='WeeklyReports!A:G'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return False
            
            # Находим строку с отчетом за указанную неделю
            print(f"🔍 [УДАЛЕНИЕ] Анализируем {len(values)-1} строк данных")
            
            for i, row in enumerate(values[1:], start=2):  # Начинаем с строки 2
                week_cell = self._safe_get_cell(row, 1)
                cleaned_week = self._clean_week_number(week_cell)
                print(f"📄 [УДАЛЕНИЕ] Строка {i}: неделя '{week_cell}' -> '{cleaned_week}'")
                
                # Улучшенное сравнение как в get_previous_week_tasks
                week_matches = (
                    cleaned_week == str(week_number) or
                    (cleaned_week.isdigit() and int(cleaned_week) == week_number)
                )
                
                if week_matches:
                    print(f"✅ [УДАЛЕНИЕ] Найдена строка {i} для недели {week_number}")
                    
                    # Получаем информацию о листе для правильного sheetId
                    sheet_metadata = self.service.spreadsheets().get(
                        spreadsheetId=self.sheet_id
                    ).execute()
                    
                    sheet_id = None
                    for sheet in sheet_metadata['sheets']:
                        if sheet['properties']['title'] == 'WeeklyReports':
                            sheet_id = sheet['properties']['sheetId']
                            break
                    
                    if sheet_id is None:
                        sheet_id = 0  # Fallback к первому листу
                    
                    print(f"📊 [УДАЛЕНИЕ] Используем sheetId: {sheet_id}")
                    
                    # Удаляем строку
                    request = {
                        'requests': [
                            {
                                'deleteDimension': {
                                    'range': {
                                        'sheetId': sheet_id,
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
                    
                    print(f"✅ [УДАЛЕНИЕ] Успешно удален отчет за неделю {week_number}")
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
    
    def get_week_report(self, week_number: int) -> Optional[Dict]:
        """Получить отчет за указанную неделю"""
        try:
            result = self.sheet.values().get(
                spreadsheetId=self.sheet_id,
                range='WeeklyReports!A:G'
            ).execute()
            
            values = result.get('values', [])
            if not values:
                return None
            
            # Ищем строку с отчетом за указанную неделю
            for i, row in enumerate(values[1:], start=2):  # Начинаем с строки 2
                week_cell = self._safe_get_cell(row, 1)
                cleaned_week = self._clean_week_number(week_cell)
                
                # Улучшенное сравнение
                week_matches = (
                    cleaned_week == str(week_number) or
                    (cleaned_week.isdigit() and int(cleaned_week) == week_number)
                )
                
                if week_matches:
                    # Возвращаем данные отчета
                    return {
                        'date': self._safe_get_cell(row, 0),
                        'week_number': week_number,
                        'rating': int(self._safe_get_cell(row, 2)) if self._safe_get_cell(row, 2).isdigit() else 0,
                        'completed_tasks': self._safe_get_cell(row, 3).split('\n') if self._safe_get_cell(row, 3) else [],
                        'incomplete_tasks': self._safe_get_cell(row, 4).split('\n') if self._safe_get_cell(row, 4) else [],
                        'planned_tasks': self._safe_get_cell(row, 5).split('\n') if self._safe_get_cell(row, 5) else [],
                        'comment': self._safe_get_cell(row, 6)
                    }
            
            return None
        except Exception as e:
            print(f"Error getting week report: {e}")
            return None

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
