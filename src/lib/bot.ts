///<reference path="util/config.util.ts"/>
import {inject, injectable} from "inversify";
import {logger} from "./logger";
import {TYPES} from "./types/types";
import * as Telegraf from 'telegraf';
import * as Extra from "telegraf/extra.js"
import {IAntifloodService, IBot, IDatabaseService} from "./types/interfaces";
import {
    ConfigurationLoader,
    EnvironmentVariableProvider,
    FileProvider,
    loadConfig,
    loadYaml,
    ObjectProvider
} from "./util/config.util";
import * as path from "path";
import {User} from "./entity/user";
import {Repository} from "typeorm";
import {Group} from "./entity/group";
import {Message, User as TgUser} from 'telegram-typings'

@injectable()
class TagAlertBot implements IBot {
    private databaseService: IDatabaseService;
    private antifloodService: IAntifloodService;
    private bot: any;
    private config: ConfigurationLoader;
    private strings: any;

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
            }));

        this.strings = loadYaml(path.resolve(__dirname, "..", "resources", "replies.yml"))
    }

    public async start() {
        try {
            const done = await this.databaseService.applyAllMigrations();
            if (done) {

            } else {
                logger.error("Something went wrong applying migrations.");
                process.exit(1);
            }
            const userRepository: Repository<User> = await this.databaseService.getRepository(User);
            const groupRepository: Repository<Group> = await this.databaseService.getRepository(Group);

            await this.bootstrap({userRepository: userRepository, groupRepository: groupRepository});

            logger.info("starting TagAlertBot");
            this.bot.startPolling();
        } catch (e) {
            logger.error(e);
        }
    }

    private async bootstrap(params: { userRepository: Repository<User>, groupRepository: Repository<Group>}) {
        const token = await this.config.load("bot.token");
        this.bot = new Telegraf(token);
        await this.registerSelf();
        await this.registerCommands();
        await this.registerOnMessage(params.userRepository, params.groupRepository);

    }

    private async registerSelf() {
        try {
            const botInfo: TgUser = await this.bot.telegram.getMe();
            console.dir(botInfo);
            console.log("================");
            this.bot.options.id = botInfo.id;
            this.bot.options.username = botInfo.username;
            console.dir(this.bot.options);
        } catch (e) {
            throw e;
        }
    }

    private async registerCommands() {

        /* Start Command*/
        this.bot.command('start', async (ctx) => {
            const message: Message = ctx.message;
            console.log("Message", message);
            if (message.chat.type !== 'private') {

            }

            if (!this.antifloodService.isFlooding(message.from.id)) {
                ctx.replyWithHTML(this.strings.en.start_private, Extra.HTML().markup((m) =>
                    m.inlineKeyboard([
                        m.urlButton(this.strings.en.add_to_group, `t.me/${this.bot.options.username}?startgroup=true`)
                    ])));
            }
        });

        /* Info Command*/
        this.bot.command('info', async (ctx) => {
            const message = ctx.message;
            if (!this.antifloodService.isFlooding(message.from.id)) {
                const sent = await ctx.reply(this.strings.en.add_to_group);
                const timeout = await this.config.load("bot.msg_timeout");
                if (timeout > 1) {
                    setTimeout(() => {
                        ctx.tg.deleteMessage(ctx.chat.id, sent.message_id)
                    }, timeout * 1000);
                } else return;
            }
        });
    }

    private async registerOnMessage(userRepository: Repository<User>, groupRepository: Repository<Group>) {
        this.bot.on('message', async (ctx) => {
            const message: Message = ctx.message;
            const from = message.from;
            console.dir(message.chat);
            if (from.is_bot) return;
            const newUser = new User(
                from.id,
                from.username,
                from.first_name,
                from.last_name,
                from.language_code
            );
            await userRepository.save(newUser);

            if (message.left_chat_member) {
                let userId = message.left_chat_member.id;
                if (userId == this.bot.myId)
                    groupRepository.deleteById(message.chat.id);
                else {
                    // db.removeUserFromGroup(userId, message.chat.id)
                    this.bot.cachedGetChatMember.delete(message.chat.id, message.from.id) // ensure we remove the cache for this user
                }
                return
            }

        })
    }

    /*db.addUser(msg.from.username, msg.from.id, msg.chat.id)

    // A user left the chat
    if (msg.left_chat_member) {
    let userId = msg.left_chat_member.id
    if (userId == bot.myId)
    db.removeGroup(msg.chat.id)
    else {
    db.removeUserFromGroup(userId, msg.chat.id)
    bot.cachedGetChatMember.delete(msg.chat.id, msg.from.id) // ensure we remove the cache for this user
}
return
}

if (
    (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') ||
    (msg.forward_from && msg.forward_from.id == bot.myId)
) return

let toBeNotified = new Set() // avoid duplicate notifications if tagged twice

// Text messages
if (msg.text && msg.entities) {
    // Extract (hash)tags from message text
    let extract = (entity) => {
        return msg.text
            .substring(entity.offset + 1, entity.offset + entity.length)
            .toLowerCase()
    }

    for (let i in msg.entities) {
        let entity = msg.entities[i]

        // Tags
        if (entity.type === 'mention') {
            let username = extract(entity)
            toBeNotified.add(username)
        }

        // Hashtags
        else if (entity.type === 'hashtag') {
            let hashtag = extract(entity)
            if (hashtag === 'everyone') {
                db.getSetting('everyone', msg.chat.id, () => {
                    db.notifyEveryone(bot, msg.from.id, msg.chat.id, msg)
                })
            }
            else if (hashtag === 'admin') {
                db.getSetting('admin', msg.chat.id, () => {
                    bot.getChatAdministrators(msg.chat.id).then((admins) => {
                        admins.forEach((admin) => {
                            db.notifyUser(bot, admin.user.id, msg, false)
                        })
                    })
                })
            }
        }

        // Users without username
        else if (entity.user)
            db.notifyUser(bot, entity.user.id, msg, false)
    }
}

// Images/media captions
else if (msg.caption) {
    let matched = msg.caption.match(/@[a-z0-9]*!/gi)
    for (let i in matched) {
        let username = matched[i].trim().substring(1).toLowerCase()
        toBeNotified.add(username)
    }
}

else return

// helpful to check if user is tagging himself
let isEqual = (u1, u2) => {
    if (u1 && u2) return u1.toLowerCase() === u2.toLowerCase()
    else return false
}

// let's really send notifications
toBeNotified.forEach((username) => {
    // check if user is tagging himself
    if (!isEqual(msg.from.username, username) || DEBUG) {
        db.notifyUser(bot, username, msg, false)
    }
})*/

}

export {TagAlertBot};
