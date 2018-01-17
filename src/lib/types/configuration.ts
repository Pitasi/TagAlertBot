import * as winston from "winston";

export interface Configuration {
    bot: BotConfig;
}

export interface BotConfig {
    token: string;
    db: DbConfig;
    logging: LoggingConfig;
}

export interface DbConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    migrations: string;
}

export interface LoggingConfig {
    level: string;
    transports: {
        http: boolean;
        console: boolean;
        file: boolean;
        memory: boolean
    };
    http: winston.HttpTransportOptions;
    console: winston.ConsoleTransportOptions;
    file: winston.FileTransportOptions;
    memory: winston.MemoryTransportOptions

}
