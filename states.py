from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional

class BotState(Enum):
    WAITING_FOR_WEEK_NUMBER = "waiting_for_week_number"
    WAITING_FOR_RATING = "waiting_for_rating"
    SELECTING_COMPLETED_TASKS = "selecting_completed_tasks"
    ADDING_ADDITIONAL_TASKS = "adding_additional_tasks"
    ADDING_PLANNED_TASKS = "adding_planned_tasks"
    EDITING_TASK = "editing_task"
    SELECTING_PRIORITY_TASK = "selecting_priority_task"
    WAITING_FOR_COMMENT = "waiting_for_comment"
    CONFIRMING_REPORT = "confirming_report"
    EDITING_REPORT = "editing_report"

@dataclass
class UserData:
    state: Optional[BotState] = None
    week_number: Optional[int] = None
    rating: Optional[int] = None
    completed_tasks: List[str] = field(default_factory=list)
    incomplete_tasks: List[str] = field(default_factory=list)
    planned_tasks: List[str] = field(default_factory=list)
    priority_task: Optional[str] = None
    comment: Optional[str] = None
    previous_planned_tasks: List[str] = field(default_factory=list)
    editing_task_index: Optional[int] = None
    current_task_input: Optional[str] = None

class UserStates:
    def __init__(self):
        self.users: Dict[int, UserData] = {}
    
    def get_user_data(self, user_id: int) -> UserData:
        if user_id not in self.users:
            self.users[user_id] = UserData()
        return self.users[user_id]
    
    def reset_user_data(self, user_id: int):
        self.users[user_id] = UserData()
    
    def set_state(self, user_id: int, state: BotState):
        user_data = self.get_user_data(user_id)
        user_data.state = state
