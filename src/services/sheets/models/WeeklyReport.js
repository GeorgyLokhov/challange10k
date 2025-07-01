/**
 * Класс WeeklyReport представляет модель еженедельного отчета
 */
class WeeklyReport {
  /**
   * Создает новый экземпляр еженедельного отчета
   * @param {Object} data - Данные для инициализации
   * @param {number} [data.weekNumber] - Номер недели
   * @param {Date|string} [data.date] - Дата отчета
   * @param {number|string} data.userId - ID пользователя
   * @param {string} data.username - Имя пользователя
   * @param {number} [data.state=5] - Оценка состояния (1-10)
   * @param {Array} [data.completedTasks=[]] - Массив выполненных задач
   * @param {Array} [data.incompleteTasks=[]] - Массив невыполненных задач
   * @param {Array} [data.nextWeekPlans=[]] - Планы на следующую неделю
   * @param {string} [data.comment=''] - Дополнительный комментарий
   */
  constructor(data = {}) {
    this.weekNumber = data.weekNumber || 0;
    this.date = data.date instanceof Date 
      ? data.date 
      : data.date ? new Date(data.date) : new Date();
    this.userId = data.userId || '';
    this.username = data.username || '';
    this.state = Math.min(Math.max(data.state || 5, 1), 10); // Ограничиваем от 1 до 10
    this.completedTasks = Array.isArray(data.completedTasks) ? data.completedTasks : [];
    this.incompleteTasks = Array.isArray(data.incompleteTasks) ? data.incompleteTasks : [];
    this.nextWeekPlans = Array.isArray(data.nextWeekPlans) ? data.nextWeekPlans : [];
    this.comment = data.comment || '';
  }

  /**
   * Создает экземпляр WeeklyReport из строки данных Google Sheets
   * @param {Array} row - Строка данных из Google Sheets
   * @returns {WeeklyReport|null} - Экземпляр отчета или null при ошибке
   */
  static fromSheetRow(row) {
    if (!row || !Array.isArray(row) || row.length < 9) {
      return null;
    }
    
    try {
      const completedTasks = row[5] ? JSON.parse(row[5]) : [];
      const incompleteTasks = row[6] ? JSON.parse(row[6]) : [];
      const nextWeekPlans = row[7] ? JSON.parse(row[7]) : [];
      
      return new WeeklyReport({
        weekNumber: parseInt(row[0], 10) || 0,
        date: row[1] ? new Date(row[1]) : new Date(),
        userId: row[2],
        username: row[3],
        state: parseFloat(row[4]) || 5,
        completedTasks,
        incompleteTasks,
        nextWeekPlans,
        comment: row[8] || ''
      });
    } catch (e) {
      console.error('Ошибка при создании WeeklyReport из строки данных:', e);
      return null;
    }
  }

  /**
   * Преобразует отчет в строку для записи в Google Sheets
   * @returns {Array} - Массив значений для строки таблицы
   */
  toSheetRow() {
    const formattedDate = this._formatDate(this.date);
    
    return [
      this.weekNumber,
      formattedDate,
      this.userId,
      this.username,
      this.state,
      JSON.stringify(this.completedTasks),
      JSON.stringify(this.incompleteTasks),
      JSON.stringify(this.nextWeekPlans),
      this.comment
    ];
  }

  /**
   * Форматирует отчет для отображения пользователю в Telegram
   * @returns {string} Форматированный текст отчета
   */
  formatForDisplay() {
    const stateEmoji = this._getStateEmoji();
    const formattedDate = this._formatDate(this.date);
    
    let result = `📋 *Еженедельный отчет*\n`;
    result += `📅 Неделя ${this.weekNumber}, ${formattedDate}\n`;
    result += `👤 ${this.username}\n\n`;
    
    result += `${stateEmoji} *Состояние:* ${this.state}/10\n\n`;
    
    // Выполненные задачи
    result += `✅ *Выполненные задачи:* ${this.completedTasks.length}\n`;
    if (this.completedTasks.length > 0) {
      this.completedTasks.forEach((task, index) => {
        result += `  ${index + 1}. ${task}\n`;
      });
    } else {
      result += `  Нет выполненных задач\n`;
    }
    
    result += `\n`;
    
    // Невыполненные задачи
    result += `❌ *Невыполненные задачи:* ${this.incompleteTasks.length}\n`;
    if (this.incompleteTasks.length > 0) {
      this.incompleteTasks.forEach((task, index) => {
        result += `  ${index + 1}. ${task}\n`;
      });
    } else {
      result += `  Нет невыполненных задач\n`;
    }
    
    result += `\n`;
    
    // Планы на следующую неделю
    result += `📝 *Планы на следующую неделю:* ${this.nextWeekPlans.length}\n`;
    if (this.nextWeekPlans.length > 0) {
      this.nextWeekPlans.forEach((task, index) => {
        result += `  ${index + 1}. ${task}\n`;
      });
    } else {
      result += `  Планы не указаны\n`;
    }
    
    // Комментарий
    if (this.comment) {
      result += `\n💬 *Комментарий:*\n${this.comment}\n`;
    }
    
    return result;
  }

  /**
   * Возвращает эмодзи для состояния
   * @returns {string} Эмодзи, соответствующее состоянию
   * @private
   */
  _getStateEmoji() {
    if (this.state <= 3) return '😢';
    if (this.state <= 5) return '😐';
    if (this.state <= 7) return '🙂';
    if (this.state <= 9) return '😊';
    return '🤩';
  }
  
  /**
   * Форматирует дату в удобочитаемый вид
   * @param {Date} date - Дата для форматирования
   * @returns {string} Строка с датой в формате DD.MM.YYYY
   * @private
   */
  _formatDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  }
}

module.exports = WeeklyReport; 