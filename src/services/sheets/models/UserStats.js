/**
 * Класс UserStats представляет статистику пользователя по еженедельным отчётам
 */
class UserStats {
  /**
   * Создает новый экземпляр UserStats
   * @param {Object} data - Данные для инициализации
   * @param {number} [data.totalReports=0] - Общее количество отчетов
   * @param {number} [data.averageState=0] - Средняя оценка состояния
   * @param {number} [data.completedTasks=0] - Количество выполненных задач
   * @param {number} [data.incompleteTasks=0] - Количество невыполненных задач
   * @param {number} [data.completionRate=0] - Процент выполнения задач
   */
  constructor(data = {}) {
    this.totalReports = data.totalReports || 0;
    this.averageState = data.averageState || 0;
    this.completedTasks = data.completedTasks || 0;
    this.incompleteTasks = data.incompleteTasks || 0;
    this.completionRate = data.completionRate || 0;
    
    // Вычисляем процент выполнения, если не задан
    if (this.completedTasks > 0 || this.incompleteTasks > 0) {
      if (this.completionRate === 0) {
        const total = this.completedTasks + this.incompleteTasks;
        this.completionRate = total > 0 
          ? Math.round((this.completedTasks / total) * 100) 
          : 0;
      }
    }
  }

  /**
   * Создает экземпляр UserStats из данных Google Sheets
   * @param {Array} reportRows - Массив строк отчетов из таблицы
   * @param {number} userId - ID пользователя
   * @returns {UserStats} - Экземпляр статистики пользователя
   */
  static fromReports(reportRows, userId) {
    if (!reportRows || !Array.isArray(reportRows) || reportRows.length === 0) {
      return new UserStats();
    }

    let totalReports = 0;
    let totalState = 0;
    let completedTasks = 0;
    let incompleteTasks = 0;

    // Обходим строки отчетов и собираем статистику
    reportRows.forEach(row => {
      if (row.length < 9) return; // Пропускаем некорректные строки
      
      // Проверяем, что отчет принадлежит нужному пользователю
      const reportUserId = row[2];
      if (reportUserId !== userId) return;
      
      totalReports++;
      
      // Сумма оценок состояния
      const state = parseFloat(row[4]) || 0;
      totalState += state;
      
      // Подсчет задач
      try {
        const completed = JSON.parse(row[5] || '[]');
        if (Array.isArray(completed)) {
          completedTasks += completed.length;
        }
        
        const incomplete = JSON.parse(row[6] || '[]');
        if (Array.isArray(incomplete)) {
          incompleteTasks += incomplete.length;
        }
      } catch (e) {
        // Игнорируем ошибки парсинга JSON
      }
    });

    // Вычисляем среднее значение состояния
    const averageState = totalReports > 0 
      ? Math.round((totalState / totalReports) * 10) / 10 
      : 0;
    
    // Вычисляем процент выполненных задач
    const totalTasks = completedTasks + incompleteTasks;
    const completionRate = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0;
    
    return new UserStats({
      totalReports,
      averageState,
      completedTasks,
      incompleteTasks,
      completionRate
    });
  }

  /**
   * Форматирует статистику для отображения пользователю
   * @returns {string} Форматированный текст со статистикой
   */
  formatForDisplay() {
    const stateEmoji = this._getStateEmoji();
    
    let result = `📊 *Ваша статистика*\n\n`;
    result += `📝 Всего отчётов: ${this.totalReports}\n`;
    result += `${stateEmoji} Средняя оценка: ${this.averageState}/10\n\n`;
    
    result += `✅ Выполнено задач: ${this.completedTasks}\n`;
    result += `❌ Не выполнено задач: ${this.incompleteTasks}\n`;
    result += `📈 Процент выполнения: ${this.completionRate}%\n\n`;
    
    // Добавляем текстовую оценку продуктивности
    result += `${this._getProductivityText()}\n`;
    
    return result;
  }

  /**
   * Возвращает эмодзи для среднего состояния
   * @returns {string} Эмодзи, соответствующее состоянию
   * @private
   */
  _getStateEmoji() {
    if (this.averageState <= 3) return '😢';
    if (this.averageState <= 5) return '😐';
    if (this.averageState <= 7) return '🙂';
    if (this.averageState <= 9) return '😊';
    return '🤩';
  }
  
  /**
   * Возвращает текстовую оценку продуктивности
   * @returns {string} Текстовая оценка
   * @private
   */
  _getProductivityText() {
    if (this.totalReports === 0) return '🔍 Пока нет данных для анализа.';
    
    // Учитываем процент выполнения задач и среднюю оценку
    if (this.completionRate >= 80 && this.averageState >= 7) {
      return '🏆 Вы отлично справляетесь со своими задачами! Так держать!';
    } else if (this.completionRate >= 60 && this.averageState >= 5) {
      return '👍 Хорошая продуктивность! Вы на верном пути.';
    } else if (this.completionRate >= 40) {
      return '🤔 Средняя продуктивность. Есть куда стремиться!';
    } else if (this.totalReports < 3) {
      return '📋 Создайте больше отчётов для подробной статистики.';
    } else {
      return '💪 Попробуйте ставить более конкретные и достижимые задачи.';
    }
  }
}

module.exports = UserStats; 