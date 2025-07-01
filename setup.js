/**
 * Скрипт для помощи в настройке проекта
 * Используется для инициализации таблиц и настройки webhook
 */

require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const axios = require('axios');

// Создаем интерфейс для чтения из консоли
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Проверка и создание переменных окружения
async function setupEnvironmentVariables() {
  console.log('\n📋 Проверка файла переменных окружения...');
  
  // Проверяем наличие .env файла
  if (!fs.existsSync('.env')) {
    console.log('⚠️  Файл .env не найден. Создаем из .env.example...');
    
    if (fs.existsSync('.env.example')) {
      fs.copyFileSync('.env.example', '.env');
      console.log('✅ Файл .env создан. Пожалуйста, отредактируйте его с вашими данными.');
    } else {
      console.error('❌ Файл .env.example не найден. Создайте .env файл вручную.');
      return false;
    }
  } else {
    console.log('✅ Файл .env существует.');
  }
  
  return true;
}

// Проверка подключения к Google Sheets API
async function testGoogleSheetsConnection() {
  console.log('\n📊 Проверка подключения к Google Sheets API...');
  
  // Проверяем наличие переменных окружения
  if (!process.env.GOOGLE_CREDENTIALS || !process.env.GOOGLE_SHEET_ID) {
    console.error('❌ Отсутствуют переменные окружения для Google Sheets API.');
    return false;
  }
  
  try {
    // Парсим учетные данные
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    
    // Создаем клиент для аутентификации
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    // Получаем авторизованный клиент
    const authClient = await auth.getClient();
    const sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    
    // Проверяем доступ к указанной таблице
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID
    });
    
    console.log(`✅ Подключение к таблице "${response.data.properties.title}" успешно установлено.`);
    return { sheetsClient, spreadsheetTitle: response.data.properties.title };
  } catch (error) {
    console.error('❌ Ошибка подключения к Google Sheets API:', error.message);
    return false;
  }
}

// Проверка и инициализация структуры таблицы
async function setupGoogleSheet(sheetsClient) {
  console.log('\n📝 Проверка структуры таблицы...');
  
  try {
    // Проверяем наличие листа "WeeklyReports"
    const response = await sheetsClient.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID
    });
    
    const sheets = response.data.sheets;
    let weeklyReportsSheet = sheets.find(sheet => 
      sheet.properties.title === 'WeeklyReports'
    );
    
    // Создаем лист, если он не существует
    if (!weeklyReportsSheet) {
      console.log('⚠️  Лист "WeeklyReports" не найден. Создаем...');
      
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'WeeklyReports'
                }
              }
            }
          ]
        }
      });
      
      console.log('✅ Лист "WeeklyReports" создан.');
      
      // Получаем обновленный список листов
      const updatedResponse = await sheetsClient.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID
      });
      
      weeklyReportsSheet = updatedResponse.data.sheets.find(sheet => 
        sheet.properties.title === 'WeeklyReports'
      );
    } else {
      console.log('✅ Лист "WeeklyReports" найден.');
    }
    
    // Проверяем наличие заголовков
    const headersResponse = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'WeeklyReports!A1:I1'
    });
    
    const headers = [
      'Неделя',
      'Дата',
      'ID пользователя',
      'Имя пользователя',
      'Состояние',
      'Выполненные задачи',
      'Невыполненные задачи',
      'Планы на следующую неделю',
      'Комментарий'
    ];
    
    // Добавляем заголовки, если их нет
    if (!headersResponse.data.values || headersResponse.data.values[0].length !== headers.length) {
      console.log('⚠️  Заголовки отсутствуют или неполные. Добавляем...');
      
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'WeeklyReports!A1:I1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });
      
      // Форматируем заголовки
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: weeklyReportsSheet.properties.sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true
                    }
                  }
                },
                fields: 'userEnteredFormat.textFormat.bold'
              }
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId: weeklyReportsSheet.properties.sheetId,
                  gridProperties: {
                    frozenRowCount: 1
                  }
                },
                fields: 'gridProperties.frozenRowCount'
              }
            }
          ]
        }
      });
      
      console.log('✅ Заголовки добавлены и отформатированы.');
    } else {
      console.log('✅ Заголовки уже существуют.');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка при настройке таблицы:', error.message);
    return false;
  }
}

// Проверка подключения к Telegram Bot API
async function testTelegramBotConnection() {
  console.log('\n🤖 Проверка подключения к Telegram Bot API...');
  
  if (!process.env.TELEGRAM_TOKEN) {
    console.error('❌ Отсутствует токен Telegram бота.');
    return false;
  }
  
  try {
    const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getMe`);
    
    if (response.data.ok) {
      const bot = response.data.result;
      console.log(`✅ Подключение к боту @${bot.username} (${bot.first_name}) установлено.`);
      return true;
    } else {
      console.error('❌ Ошибка при подключении к боту:', response.data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка при подключении к Telegram API:', error.message);
    return false;
  }
}

// Настройка webhook для Telegram бота
async function setupTelegramWebhook() {
  console.log('\n🔄 Настройка webhook для Telegram бота...');
  
  if (!process.env.TELEGRAM_TOKEN || !process.env.SERVER_BASE_URL) {
    console.error('❌ Отсутствуют переменные окружения TELEGRAM_TOKEN или SERVER_BASE_URL.');
    return false;
  }
  
  try {
    // Сначала удаляем текущий webhook
    await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/deleteWebhook`);
    
    // Устанавливаем новый webhook
    const webhookUrl = `${process.env.SERVER_BASE_URL}/api/webhook/telegram`;
    const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/setWebhook`, {
      params: {
        url: webhookUrl,
        allowed_updates: JSON.stringify(['message', 'callback_query'])
      }
    });
    
    if (response.data.ok) {
      console.log(`✅ Webhook успешно установлен на ${webhookUrl}`);
      return true;
    } else {
      console.error('❌ Ошибка при установке webhook:', response.data.description);
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка при настройке webhook:', error.message);
    return false;
  }
}

// Создание директории для логов
function setupLogDirectory() {
  console.log('\n📁 Проверка директории для логов...');
  
  const logDir = process.env.LOG_DIRECTORY || 'logs';
  
  if (!fs.existsSync(logDir)) {
    console.log(`⚠️  Директория ${logDir} не найдена. Создаем...`);
    try {
      fs.mkdirSync(logDir, { recursive: true });
      console.log(`✅ Директория ${logDir} создана.`);
    } catch (error) {
      console.error('❌ Ошибка при создании директории для логов:', error.message);
      return false;
    }
  } else {
    console.log(`✅ Директория ${logDir} существует.`);
  }
  
  return true;
}

// Основная функция настройки
async function runSetup() {
  console.log('\n🚀 Запуск настройки Weekly Reports Bot...');
  
  // Шаг 1: Проверка переменных окружения
  const envReady = await setupEnvironmentVariables();
  if (!envReady) {
    console.log('\n⚠️  Пожалуйста, настройте переменные окружения и запустите скрипт снова.');
    rl.close();
    return;
  }
  
  // Шаг 2: Проверка директории для логов
  const logDirReady = setupLogDirectory();
  if (!logDirReady) {
    console.log('\n⚠️  Проблема с директорией для логов.');
  }
  
  // Шаг 3: Проверка подключения к Google Sheets API
  const sheetsConnection = await testGoogleSheetsConnection();
  if (!sheetsConnection) {
    console.log('\n⚠️  Пожалуйста, проверьте настройки Google Sheets API и запустите скрипт снова.');
    rl.close();
    return;
  }
  
  // Шаг 4: Настройка структуры таблицы
  const sheetReady = await setupGoogleSheet(sheetsConnection.sheetsClient);
  if (!sheetReady) {
    console.log('\n⚠️  Проблема с настройкой таблицы.');
  }
  
  // Шаг 5: Проверка подключения к Telegram Bot API
  const telegramReady = await testTelegramBotConnection();
  if (!telegramReady) {
    console.log('\n⚠️  Пожалуйста, проверьте токен Telegram бота и запустите скрипт снова.');
    rl.close();
    return;
  }
  
  // Шаг 6: Настройка webhook
  console.log('\nХотите настроить webhook для Telegram бота? (y/n)');
  rl.question('> ', async (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      const webhookReady = await setupTelegramWebhook();
      if (!webhookReady) {
        console.log('\n⚠️  Проблема с настройкой webhook.');
      }
    } else {
      console.log('\n⏭️  Настройка webhook пропущена.');
    }
    
    console.log('\n✅ Настройка завершена!');
    console.log('\n📝 Рекомендации:');
    console.log('1. Запустите приложение: npm run dev (разработка) или npm start (продакшн)');
    console.log('2. Отправьте команду /start вашему боту в Telegram');
    
    rl.close();
  });
}

// Запуск настройки
runSetup().catch(error => {
  console.error('❌ Ошибка во время настройки:', error);
  rl.close();
}); 