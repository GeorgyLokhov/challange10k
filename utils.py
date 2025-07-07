from states import UserData
from typing import List

# Кастомные эмоджи для разных типов задач
CUSTOM_EMOJIS = {
    'planned_next_week': '5330491216804982283',      # Запланированные задачи
    'unplanned_done': '5319306413296599737',         # Внепланово сделанные  
    'planned_done': '5330476162944609974',           # Планово сделанные
    'planned_undone': '5343961965117061104'          # Запланированные, но не сделанные
}

def format_report_message(user_data: UserData) -> str:
    """Форматирование итогового отчёта с правильными символами и сортировкой"""
    
    # Собираем все выполненные/невыполненные задачи с метаданными
    all_completed_tasks = []
    
    # Планово выполненные задачи (из previous_planned_tasks)
    for task in user_data.completed_tasks:
        if task in user_data.previous_planned_tasks:
            is_priority = task == user_data.priority_task
            symbol = "✓ ✶" if is_priority else "✓"
            all_completed_tasks.append({
                'text': f"{symbol} {task}",
                'is_priority': is_priority,
                'type': 'planned_done'
            })
    
    # Дополнительно сделанные задачи (не было в планах)
    for task in user_data.completed_tasks:
        if task not in user_data.previous_planned_tasks:
            is_priority = task == user_data.priority_task
            symbol = "+ ✶" if is_priority else "+"
            all_completed_tasks.append({
                'text': f"{symbol} {task}",
                'is_priority': is_priority,
                'type': 'additional_done'
            })
    
    # Невыполненные задачи (из планов, но не сделанные)
    for task in user_data.incomplete_tasks:
        is_priority = task == user_data.priority_task
        symbol = "- ✶" if is_priority else "-"
        all_completed_tasks.append({
            'text': f"{symbol} {task}",
            'is_priority': is_priority,
            'type': 'undone'
        })
    
    # Сортируем: приоритетные задачи сначала
    all_completed_tasks.sort(key=lambda x: (not x['is_priority'], x['type']))
    completed_section = [item['text'] for item in all_completed_tasks]
    
    # Формируем планируемые задачи с правильной сортировкой
    all_planned_tasks = []
    for task in user_data.planned_tasks:
        is_priority = task == user_data.priority_task
        symbol = "☐ ✶" if is_priority else "☐"
        all_planned_tasks.append({
            'text': f"{symbol} {task}",
            'is_priority': is_priority
        })
    
    # Сортируем планируемые: приоритетные сначала
    all_planned_tasks.sort(key=lambda x: not x['is_priority'])
    planned_section = [item['text'] for item in all_planned_tasks]
    
    report = f"""#итоги_недели@lifedescription

{user_data.week_number} неделя

1. Состояние: {user_data.rating}/10

2. Что было сделано:
{chr(10).join(completed_section) if completed_section else "Нет выполненных задач"}

3. Планы на следующую неделю:
{chr(10).join(planned_section) if planned_section else "Нет запланированных задач"}

4. Комментарий: {user_data.comment or "Нет комментария"}"""
    
    return report

def validate_week_number(week_str: str) -> tuple[bool, int]:
    """Проверка корректности номера недели"""
    try:
        week = int(week_str)
        if week <= 0:
            return False, 0
        return True, week
    except ValueError:
        return False, 0
