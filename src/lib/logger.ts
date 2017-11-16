/*
Still have to understand how to configure winston in typescript.

import {createLogger, format, transports} from "winston";

const {combine, timestamp, printf} = format;

const logFormat = printf((info: any) => {
    return `${info.level}: ${info.timestamp} - ${info.message}`;
});

const logger = createLogger({
    level: "debug",
    format: combine(
        timestamp(),
        logFormat,
    ),
    transports: [new transports.Console()],
});
*/

import * as winston from "winston";

const logger = winston;

logger.configure({
    level: "debug",
    transports: [new logger.transports.Console({colorize: true})],
});
export {logger};
