/**
 * Модуль логирования
 * Настройка и экспорт логгера Winston
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Создаем директорию для логов, если она не существует
const logDir = config.logger.directory;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Настройка формата логирования
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(info => {
    return `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`;
  })
);

// Создание логгера
const logger = winston.createLogger({
  level: config.logger.level,
  format: logFormat,
  transports: [
    // Лог в консоль
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // Лог всех сообщений
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
    // Лог только ошибок
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    })
  ]
});

// Вспомогательные методы для упрощения использования
logger.success = (message, meta = {}) => {
  logger.info(`✅ ${message}`, meta);
};

logger.fail = (message, meta = {}) => {
  logger.error(`❌ ${message}`, meta);
};

logger.warn = (message, meta = {}) => {
  logger.warning(`⚠️ ${message}`, meta);
};

module.exports = logger; 