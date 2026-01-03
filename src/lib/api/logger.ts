// Logger for Next.js API routes
// Simplified version of winston logger
import winston from 'winston';
import config from './config';

const { combine, timestamp, printf, errors, json, align, colorize } = winston.format;

const transports: winston.transport[] = [];

if (config.NODE_ENV !== 'production') {
	transports.push(
		new winston.transports.Console({
			format: combine(
				colorize({ all: true }),
				timestamp({ format: 'YYYY-MM-DD HH:mm:ss A' }),
				align(),
				printf(({ timestamp, level, message, ...meta }) => {
					const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta)}` : '';
					return `${timestamp} [${level}]: ${message}${metaStr}`;
				})
			),
		})
	);
} else {
	transports.push(
		new winston.transports.Console({
			format: combine(timestamp(), errors({ stack: true }), json()),
		})
	);
}

const logger = winston.createLogger({
	level: config.LOG_LEVEL,
	format: combine(timestamp(), errors({ stack: true }), json()),
	transports,
	silent: config.NODE_ENV === 'test',
});

export { logger };


