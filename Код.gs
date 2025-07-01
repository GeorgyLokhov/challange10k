// Google Apps Script код для работы с Google Sheets

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch (action) {
      case 'saveReport':
        return saveReport(data.data);
      case 'getLastReport':
        return getLastReport(data.data.userId);
      case 'getUserStats':
        return getUserStats(data.data.userId);
      default:
        return ContentService
          .createTextOutput(JSON.stringify({success: false, error: 'Unknown action'}))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function saveReport(reportData) {
  try {
    const sheet = getOrCreateSheet('WeeklyReports');
    
    // Добавляем заголовки, если лист пустой
    if (sheet.getLastRow() === 0) {
      const headers = [
        'Timestamp', 'UserId', 'Username', 'WeekNumber', 'State',
        'CompletedTasks', 'IncompleteTasks', 'NextWeekPlans', 'Comment'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // Подготавливаем данные для записи
    const row = [
      new Date(reportData.createdAt),
      reportData.userId,
      reportData.username,
      reportData.weekNumber,
      reportData.state,
      JSON.stringify(reportData.completedTasks),
      JSON.stringify(reportData.incompleteTasks),
      JSON.stringify(reportData.nextWeekPlans),
      reportData.comment
    ];
    
    // Добавляем строку
    sheet.appendRow(row);
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error in saveReport: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getLastReport(userId) {
  try {
    const sheet = getOrCreateSheet('WeeklyReports');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({success: true, data: null}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Ищем последний отчет пользователя
    let lastReport = null;
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][1] === userId) { // UserId в колонке B (индекс 1)
        lastReport = {
          userId: data[i][1],
          username: data[i][2],
          weekNumber: data[i][3],
          state: data[i][4],
          completedTasks: JSON.parse(data[i][5] || '[]'),
          incompleteTasks: JSON.parse(data[i][6] || '[]'),
          nextWeekPlans: JSON.parse(data[i][7] || '[]'),
          comment: data[i][8] || '',
          createdAt: data[i][0]
        };
        break;
      }
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true, data: lastReport}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error in getLastReport: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getUserStats(userId) {
  try {
    const sheet = getOrCreateSheet('WeeklyReports');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: true, 
          data: {
            totalReports: 0,
            averageState: 0,
            completedTasks: 0,
            incompleteTasks: 0,
            completionRate: 0
          }
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    let totalReports = 0;
    let totalState = 0;
    let totalCompleted = 0;
    let totalIncomplete = 0;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId) {
        totalReports++;
        totalState += data[i][4] || 0;
        
        const completed = JSON.parse(data[i][5] || '[]');
        const incomplete = JSON.parse(data[i][6] || '[]');
        
        totalCompleted += completed.length;
        totalIncomplete += incomplete.length;
      }
    }
    
    const averageState = totalReports > 0 ? Math.round((totalState / totalReports) * 10) / 10 : 0;
    const totalTasks = totalCompleted + totalIncomplete;
    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
    
    const stats = {
      totalReports,
      averageState,
      completedTasks: totalCompleted,
      incompleteTasks: totalIncomplete,
      completionRate
    };
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true, data: stats}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log('Error in getUserStats: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  
  return sheet;
} 