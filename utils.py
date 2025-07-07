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
    """Форматирование итогового отчёта с правильными символами"""
    
    # Формируем выполненные задачи с разделением на планово и дополнительно сделанные
    completed_section = []
    
    # Планово выполненные задачи (из previous_planned_tasks)
    for task in user_data.completed_tasks:
        if task in user_data.previous_planned_tasks:
            if task == user_data.priority_task:
                completed_section.append(f"✓ {task} ✶")
            else:
                completed_section.append(f"✓ {task}")
    
    # Дополнительно сделанные задачи (не было в планах)
    for task in user_data.completed_tasks:
        if task not in user_data.previous_planned_tasks:
            if task == user_data.priority_task:
                completed_section.append(f"+ {task} ✶")
            else:
                completed_section.append(f"+ {task}")
    
    # Невыполненные задачи (из планов, но не сделанные)
    for task in user_data.incomplete_tasks:
        completed_section.append(f"- {task}")
    
    # Формируем планируемые задачи
    planned_section = []
    for task in user_data.planned_tasks:
        if task == user_data.priority_task:
            planned_section.append(f"☐ {task} ✶")
        else:
            planned_section.append(f"☐ {task}")
    
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
