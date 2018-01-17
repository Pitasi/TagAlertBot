import "reflect-metadata"; // IMPORTANT This should always be first. ALWAYS
import {Container} from "inversify";
import {TagAlertBot} from "./bot";
import {DatabaseServiceImpl} from "./service/database.service";
import {IAntifloodService, IBot, IDatabaseService} from "./types/interfaces";
import {TYPES} from "./types/types";
import AntiFoodServiceImpl from "./service/antiflood.service";
import {
    ConfigurationLoader, EnvironmentVariableProvider, FileProvider, loadConfig,
    ObjectProvider
} from "./util/config.util";
import * as path from "path";
import {createLogger} from "./logger";
import * as winston from "winston";
import {LoggingConfig} from "./types/configuration";
import {GenericTransportOptions, LoggerOptions} from "winston";

const container = new Container();

container.bind<IBot>(TYPES.Bot).to(TagAlertBot);
container.bind<IDatabaseService>(TYPES.DatabaseService).to(DatabaseServiceImpl);
container.bind<IAntifloodService>(TYPES.AntifloodService).to(AntiFoodServiceImpl);

container.bind<ConfigurationLoader>(TYPES.ConfigurationLoader).toConstantValue(loadConfig(new EnvironmentVariableProvider())
    .orElse(new FileProvider(path.resolve(__dirname, "..", "resources", "config.json")))
    .orElse(new ObjectProvider({
        bot: {
            msg_timeout: 25
        }
    })));

/* Winston Logger */
container.bind<winston.Winston>(TYPES.Logger).toDynamicValue(context => {
    const loader = context.container.get<ConfigurationLoader>(TYPES.ConfigurationLoader);
    const logging: LoggingConfig = loader.loadSync("bot.logging");
    const transports: winston.TransportInstance[] = [];
    const keys = Object.keys(winston.transports);
    for (let t of keys) {
        const active: boolean = logging.transports[t.toLowerCase()] || false;
        if ((logging.transports as Object).hasOwnProperty(t.toLowerCase()) && active) {
            const options: GenericTransportOptions = logging[t.toLowerCase()];
            const trans = new winston.transports[t](options);
            transports.push(trans);
        }
    }
    const loggerOpt: LoggerOptions = {
        level: logging.level,
        transports: transports,
    };
    return createLogger(loggerOpt);
});
export {container};
