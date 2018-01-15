///<reference path="util/config.util.ts"/>
import {inject, injectable} from "inversify";
import {logger} from "./logger";
import {TYPES} from "./types/types";
import Replies from '../resources/replies.js'
import * as Telegraf from 'telegraf';
import * as Extra from "telegraf/extra.js"
import {IAntifloodService, IBot, IDatabaseService} from "./types/interfaces";
import {
    ConfigurationLoader,
    EnvironmentVariableProvider,
    FileProvider,
    loadConfig,
    ObjectProvider
} from "./util/config.util";
import * as path from "path";

// import * as Extra from "telegraf/extra";

@injectable()
class TagAlertBot implements IBot {
    private databaseService: IDatabaseService;
    private antifloodService: IAntifloodService;
    private bot: any;
    private config: ConfigurationLoader;

    public constructor(@inject(TYPES.DatabaseService) databaseService: IDatabaseService,
                       @inject(TYPES.AntifloodService) antifloodService: IAntifloodService) {
        this.databaseService = databaseService;
        this.antifloodService = antifloodService;
        this.config = loadConfig(new EnvironmentVariableProvider())
            .orElse(new FileProvider(path.resolve(__dirname, "..", "resources", "config.json")))
            .orElse(new ObjectProvider({
                bot: {
                    msg_timeout: 25,
                }
            }))
    }

    public async start() {
        try {
            const done = await this.databaseService.applyAllMigrations();
            if (done) {

            } else {
                logger.error("Something went wrong applying migrations.");
                process.exit(1);
            }

            await this.bootstrap();
            // const userRepository: Repository<User> = await this.databaseService.getRepository(User);


            logger.info("starting TagAlertBot");
            this.bot.startPolling();
        } catch (e) {
            logger.error(e);
        }
    }

    private async bootstrap() {
        const token = await this.config.load("bot.token");
        this.bot = new Telegraf(token);
        await this.registerSelf();
        await this.registerCommands();

    }

    private async registerSelf() {
        try {
            const botInfo = await this.bot.telegram.getMe();
            this.bot.options.username = botInfo.username;
        } catch (e) {
            throw e;
        }
    }

    private async registerCommands() {

        /* Start Command*/
        this.bot.command('start', async (ctx) => {
            const message = ctx.message;
            console.dir(message);
            if (message.chat.type !== 'private') return;

            if (!this.antifloodService.isFlooding(message.from.id)) {
                ctx.replyWithHTML(Replies.start_private, Extra.HTML().markup((m) =>
                    m.inlineKeyboard([
                        m.urlButton(Replies.add_to_group, 't.me/TagAlertBot?startgroup=true')
                    ])));
            }
        });

        /* Info Command*/
        this.bot.command('info', async (ctx) => {
            const message = ctx.message;
            if (!this.antifloodService.isFlooding(message.from.id)) {
                const sent = await ctx.reply(Replies.add_to_group);
                const timeout = await this.config.load("bot.msg_timeout");
                if (timeout > 1 ) {
                    setTimeout(() => {
                        ctx.tg.deleteMessage(ctx.chat.id, sent.message_id)
                    }, timeout * 1000);
                } else return;
            }
        });
    }

}

export {TagAlertBot};
