/**
 * WeeklyReport
 * 
 * Модель данных для еженедельных отчетов
 * Представляет структуру отчета пользователя о проделанной работе
 */

class WeeklyReport {
  /**
   * Создает новый экземпляр еженедельного отчета
   * @param {Object} data - Данные отчета
   * @param {string} [data.id] - Уникальный идентификатор отчета
   * @param {number} data.userId - ID пользователя в Telegram
   * @param {string} [data.date] - Дата создания отчета
   * @param {string} [data.status] - Статус самочувствия
   * @param {Array<string>} [data.completedTasks] - Выполненные задачи
   * @param {Array<string>} [data.plannedTasks] - Планируемые задачи
   * @param {string} [data.comment] - Комментарий к отчету
   */
  constructor(data = {}) {
    // Если ID не указан, генерируем новый
    this.id = data.id || this.generateId();
    this.userId = data.userId;
    
    // Если дата не указана, используем текущую
    this.date = data.date || this._getCurrentDate();
    
    // Статус самочувствия (по умолчанию "Нормальное")
    this.status = data.status || 'Нормальное';
    
    // Списки задач
    this.completedTasks = data.completedTasks || [];
    this.plannedTasks = data.plannedTasks || [];
    
    // Дополнительный комментарий
    this.comment = data.comment || '';
  }

  /**
   * Генерирует уникальный идентификатор для отчета
   * @returns {string} - Уникальный ID
   * @private
   */
  generateId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${timestamp}-${random}`;
  }

  /**
   * Возвращает текущую дату в формате YYYY-MM-DD
   * @returns {string} - Текущая дата
   * @private
   */
  _getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Добавляет выполненную задачу в отчет
   * @param {string} task - Текст задачи
   * @returns {WeeklyReport} - this для цепочки вызовов
   */
  addCompletedTask(task) {
    if (task && typeof task === 'string' && task.trim()) {
      this.completedTasks.push(task.trim());
    }
    return this;
  }

  /**
   * Добавляет планируемую задачу в отчет
   * @param {string} task - Текст задачи
   * @returns {WeeklyReport} - this для цепочки вызовов
   */
  addPlannedTask(task) {
    if (task && typeof task === 'string' && task.trim()) {
      this.plannedTasks.push(task.trim());
    }
    return this;
  }

  /**
   * Устанавливает статус самочувствия
   * @param {string} status - Статус самочувствия
   * @returns {WeeklyReport} - this для цепочки вызовов
   */
  setStatus(status) {
    if (status && typeof status === 'string') {
      this.status = status.trim();
    }
    return this;
  }

  /**
   * Устанавливает комментарий к отчету
   * @param {string} comment - Текст комментария
   * @returns {WeeklyReport} - this для цепочки вызовов
   */
  setComment(comment) {
    if (comment && typeof comment === 'string') {
      this.comment = comment.trim();
    }
    return this;
  }

  /**
   * Проверяет, готов ли отчет для отправки
   * @returns {boolean} - true, если отчет готов
   */
  isValid() {
    // Проверяем наличие обязательных полей
    if (!this.userId) {
      return false;
    }
    
    // Отчет должен содержать хотя бы одну выполненную или планируемую задачу
    if (this.completedTasks.length === 0 && this.plannedTasks.length === 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Преобразует отчет в массив данных для сохранения в Google Sheets
   * @returns {Array} - Массив значений для сохранения
   */
  toSheetRow() {
    return [
      this.date,
      this.status,
      this.completedTasks.join(';'),
      this.plannedTasks.join(';'),
      this.comment
    ];
  }

  /**
   * Форматирует отчет для отображения пользователю
   * @returns {string} - Отформатированный отчет
   */
  formatForDisplay() {
    let report = `*Еженедельный отчет за ${this.date}*\n\n`;
    report += `*Самочувствие:* ${this.status}\n\n`;

    if (this.completedTasks.length > 0) {
      report += '*Выполненные задачи:*\n';
      this.completedTasks.forEach(task => {
        report += `- ${task}\n`;
      });
      report += '\n';
    }

    if (this.plannedTasks.length > 0) {
      report += '*Планы на следующую неделю:*\n';
      this.plannedTasks.forEach(task => {
        report += `- ${task}\n`;
      });
      report += '\n';
    }

    if (this.comment) {
      report += `*Комментарий:*\n${this.comment}\n`;
    }

    return report;
  }

  /**
   * Создает отчет из строки данных Google Sheets
   * @param {Array} row - Строка данных из таблицы
   * @returns {WeeklyReport} - Экземпляр отчета
   * @static
   */
  static fromSheetRow(row) {
    return new WeeklyReport({
      id: row[0],
      userId: row[1],
      date: row[2],
      status: row[3],
      completedTasks: row[4] ? row[4].split(';') : [],
      plannedTasks: row[5] ? row[5].split(';') : [],
      comment: row[6] || ''
    });
  }
}

module.exports = WeeklyReport; 