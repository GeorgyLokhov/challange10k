/**
 * UserStats
 * 
 * Модель данных для статистики пользователя
 * Хранит информацию о пользователе и его активности
 */

class UserStats {
  /**
   * Создает новый экземпляр статистики пользователя
   * @param {Object} data - Данные пользователя
   * @param {number} data.userId - ID пользователя в Telegram
   * @param {string} [data.username] - Имя пользователя в Telegram
   * @param {string} [data.firstName] - Имя пользователя
   * @param {string} [data.lastName] - Фамилия пользователя
   * @param {string} [data.registrationDate] - Дата регистрации
   * @param {string} [data.lastReportDate] - Дата последнего отчета
   * @param {number} [data.reportsCount] - Количество созданных отчетов
   * @param {number} [data.completedTasksCount] - Количество выполненных задач
   * @param {number} [data.plannedTasksCount] - Количество запланированных задач
   */
  constructor(data = {}) {
    // Обязательное поле - ID пользователя
    if (!data.userId) {
      throw new Error('ID пользователя является обязательным полем');
    }
    
    this.userId = data.userId;
    this.username = data.username || null;
    this.firstName = data.firstName || null;
    this.lastName = data.lastName || null;
    
    // Если дата регистрации не указана, используем текущую
    this.registrationDate = data.registrationDate || this._getCurrentDate();
    
    // Дата последнего отчета (может быть null)
    this.lastReportDate = data.lastReportDate || null;
    
    // Статистика
    this.reportsCount = data.reportsCount || 0;
    this.completedTasksCount = data.completedTasksCount || 0;
    this.plannedTasksCount = data.plannedTasksCount || 0;
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
   * Обновляет статистику после создания нового отчета
   * @param {number} completedTasks - Количество выполненных задач
   * @param {number} plannedTasks - Количество запланированных задач
   * @returns {UserStats} - this для цепочки вызовов
   */
  updateAfterReport(completedTasks, plannedTasks) {
    this.reportsCount++;
    this.lastReportDate = this._getCurrentDate();
    this.completedTasksCount += completedTasks;
    this.plannedTasksCount += plannedTasks;
    return this;
  }

  /**
   * Обновляет персональную информацию пользователя
   * @param {Object} userInfo - Информация о пользователе из Telegram
   * @returns {UserStats} - this для цепочки вызовов
   */
  updateUserInfo(userInfo) {
    if (userInfo) {
      if (userInfo.username) this.username = userInfo.username;
      if (userInfo.first_name) this.firstName = userInfo.first_name;
      if (userInfo.last_name) this.lastName = userInfo.last_name;
    }
    return this;
  }

  /**
   * Возвращает полное имя пользователя
   * @returns {string} - Полное имя
   */
  getFullName() {
    let name = this.firstName || '';
    if (this.lastName) {
      name += name ? ` ${this.lastName}` : this.lastName;
    }
    return name || this.username || `Пользователь ${this.userId}`;
  }

  /**
   * Преобразует статистику в массив для сохранения в Google Sheets
   * @returns {Array} - Массив значений для сохранения
   */
  toSheetRow() {
    return [
      this.userId,
      this.username || '',
      this.firstName || '',
      this.lastName || '',
      this.registrationDate,
      this.lastReportDate || '',
      this.reportsCount,
      this.completedTasksCount,
      this.plannedTasksCount
    ];
  }

  /**
   * Создает статистику из строки данных Google Sheets
   * @param {Array} row - Строка данных из таблицы
   * @returns {UserStats} - Экземпляр статистики
   * @static
   */
  static fromSheetRow(row) {
    return new UserStats({
      userId: row[0],
      username: row[1] || null,
      firstName: row[2] || null,
      lastName: row[3] || null,
      registrationDate: row[4],
      lastReportDate: row[5] || null,
      reportsCount: parseInt(row[6] || '0', 10),
      completedTasksCount: parseInt(row[7] || '0', 10),
      plannedTasksCount: parseInt(row[8] || '0', 10)
    });
  }
}

module.exports = UserStats; 