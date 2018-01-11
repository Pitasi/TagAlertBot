import {inject, injectable} from "inversify";
import {logger} from "./logger";
import {TYPES} from "./types/types";
import {User} from "./entity/user";
import {Repository} from "typeorm";
import * as util from "util";
import {Telegraf} from 'telegraf';

@injectable()
class TagAlertBot implements IBot {
    private databaseService: IDatabaseService;
    private bot: any;

    public constructor(@inject(TYPES.DatabaseService) databaseService: IDatabaseService) {
        this.databaseService = databaseService;
        this.bot = new Telegraf(config.token);
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

            const me = await bot.getMe();
            bot.myId = me.id;
            if (config.adminId) {
                bot.sendMessage(config.adminId, util.format(replies.booting, me.username));
            }

            const userRepository: Repository<User> = await this.databaseService.getRepository(User);
            const user = new User();
            user.id = 1;
            user.username = "Matteo";
            await userRepository.save(user);
            const users = await userRepository.find();
            console.log("Found: ", users);
        } catch (e: Error) {
            logger.error(e);
        }
    }

    private bootstrap() {

    }
}

export {TagAlertBot};
