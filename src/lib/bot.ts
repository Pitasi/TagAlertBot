///<reference path="util/config.util.ts"/>
import {inject, injectable} from "inversify";
import {logger} from "./logger";
import {TYPES} from "./types/types";
import {User} from "./entity/user";
import {Repository} from "typeorm";
import * as util from "util";
import * as Telegraf from 'telegraf';
import {IBot, IDatabaseService} from "./types/interfaces";
import {
    ConfigurationLoader, EnvironmentVariableProvider, FileProvider, loadConfig,
    ObjectProvider
} from "./util/config.util";
import * as path from "path";

@injectable()
class TagAlertBot implements IBot {
    private databaseService: IDatabaseService;
    private bot: any;
    private config: ConfigurationLoader;

    public constructor(@inject(TYPES.DatabaseService) databaseService: IDatabaseService) {
        this.databaseService = databaseService;
        this.config = loadConfig(new EnvironmentVariableProvider())
            .orElse(new FileProvider(path.resolve(__dirname, "..", "config.json")))
            .orElse(new ObjectProvider({
                test: "Another testing",
                bot: {
                    token: "token"
                }
            }))
    }

    public async start() {
        logger.info("starting TagAlertBot");
        /* this.databaseService.applyAllMigrations().then(done => {
             if (done) {

             } else {
                 logger.error("Something went wrong applying migrations.");
                 process.exit(1);
             }
         });*/
        try {

            /* const me = await bot.getMe();
             bot.myId = me.id;
             if (config.adminId) {
                 bot.sendMessage(config.adminId, util.format(replies.booting, me.username));
             }*/
            const test = await this.config.load("test");
            console.log("Test:", test);
            await this.bootstrap();
            const userRepository: Repository<User> = await this.databaseService.getRepository(User);
            const user = new User();
            user.id = 1;
            user.username = "Matteo";
            await userRepository.save(user);
            const users = await userRepository.find();
            console.log("Found: ", users);
            this.bot.startPolling();
        } catch (e) {
            logger.error(e);
        }
    }

    private async bootstrap() {
        const token = await this.config.load("bot.token");
        this.bot = new Telegraf(token);
        this.bot.command("test", (ctx) => {
            ctx.reply("Hello, I'm Tagalert 3.0!")
        } )

    }
}

export {TagAlertBot};
