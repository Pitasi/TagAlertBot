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
import {Message, User as TgUser, MessageEntity, Chat} from 'telegram-typings'
import Optional from "typescript-optional";
import has = Reflect.has;
import {message} from "gulp-typescript/release/utils";

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

    private async bootstrap(params: { userRepository: Repository<User>, groupRepository: Repository<Group> }) {
        const token = await this.config.load("bot.token");
        this.bot = new Telegraf(token);
        await this.registerSelf();
        await this.registerCommands(params.userRepository, params.groupRepository);
        await this.registerOnMessage(params.userRepository, params.groupRepository);

    }

    private async registerSelf() {
        try {
            const botInfo: TgUser = await this.bot.telegram.getMe();
            logger.debug("bot informations:\n", JSON.stringify(botInfo, null, 2));
            this.bot.options.id = botInfo.id;
            this.bot.options.username = botInfo.username;
        } catch (e) {
            throw e;
        }
    }

    private async registerCommands(userRepository: Repository<User>, groupRepository: Repository<Group>) {

        /* Start Command*/
        this.bot.command('start', async (ctx) => {
            const message: Message = ctx.message;
            const from = message.from;
            console.log("Message", message);
            const chat = message.chat;
            if (chat.type !== 'private') {
                const sender = await userRepository.findOneById(from.id);
                const group = Optional.ofNullable(await groupRepository.findOneById(chat.id))
                    .orElse(new Group(
                        chat.id,
                        chat.title,
                        chat.type,
                        chat.all_members_are_administrators));
                if (sender != undefined) group.users.push(sender);

                await groupRepository.save(group);
                logger.info("started in new group", group);
                return;
            }

            if (!this.antifloodService.isFlooding(from.id)) {
                const newUser = new User(
                    from.id,
                    from.username,
                    from.first_name,
                    from.last_name,
                    from.language_code
                );
                await userRepository.save(newUser);
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
            // const chatMember = await ctx.getChatMember(81841319);
            // console.log("ChatMember", chatMember);
            const message: Message = ctx.message;
            // console.log("Incoming\n", message);
            const from = message.from;
            if (from.is_bot) return;
            if (message.chat.type !== 'private') {
                const group = await groupRepository.findOneById(message.chat.id, {relations: ['users']});
                const sender = await userRepository.findOneById(from.id);
                if (sender != undefined) {
                    const count = group.users.filter(u => u.id === sender.id).length;
                    if (count < 1) {
                        group.users.push(sender);
                        await groupRepository.save(group);
                    }
                }

                if (message.left_chat_member) {
                    const userId = message.left_chat_member.id;
                    if (userId == this.bot.options.id)
                        await groupRepository.deleteById(message.chat.id);
                    else {
                        const group = await groupRepository.findOneById(message.chat.id);
                        const index = group.users.findIndex((user: User) => user.id === userId);
                        if (index > -1) {
                            group.users.splice(index, 1)
                        }
                    }
                    return;
                }
                if (message.forward_from && message.forward_from.id == this.bot.options.id) return;

                const toBeNotified = new Set<string>();
                if (message.text && message.entities) {
                    for (let entity of message.entities) {

                        switch (entity.type) {
                            case 'mention':
                                this.handleMentions(toBeNotified, message, entity);
                                break;
                            case 'hashtag':
                                this.handleHashtags(message, entity);
                                break;
                            default:
                                if (entity.user) {
                                    // db.notifyUser(bot, entity.user.id, msg, false)
                                }
                                break;
                        }
                    }

                } else if (message.caption) {
                    this.handleCaption(toBeNotified, message);
                } else return;


                toBeNotified.forEach(async username => {
                    /*if (!isEqual(msg.from.username, username) || DEBUG) {
                        db.notifyUser(bot, username, msg, false)
                    }*/

                    if (!this.isEqual(from.username, username)) {
                        await this.notifyUser(message.chat, username, null, userRepository, groupRepository);
                        // db.notifyUser(bot, username, msg, false)
                    }
                })
                // bot.cachedGetChatMember.delete(msg.chat.id, msg.from.id) // ensure we remove the cache for this user
            }


        })
    }


    private isEqual(u1: string, u2: string) {
        return u1 && u2 ? u1.toLowerCase() === u2.toLowerCase() : false;
    }

    private extract(message: Message, entity: MessageEntity) {
        return message.text
            .substring(entity.offset + 1, entity.offset + entity.length);
    }

    private handleCaption(toBeNotified: Set<string>, message: Message) {
        const matched = message.caption.match(/@[a-z0-9]*!/gi);
        if (matched != null) {
            for (let i in matched) {
                logger.debug("processing caption for ", {usernames: matched}, "message:", message);
                const username = matched[i].trim().substring(1).toLowerCase();
                toBeNotified.add(username);
            }
        }
    }

    private handleMentions(toBeNotified: Set<String>, message: Message, entity: MessageEntity) {
        const username = this.extract(message, entity);
        logger.debug("processing", {mention: username}, "message:", message);
        toBeNotified.add(username);
    }

    private handleHashtags(message: Message, entity: MessageEntity) {
        const hashtag = this.extract(message, entity);
        logger.debug("processing", {hashtag: hashtag}, "message:", message);
        switch (hashtag) {
            case 'everyone':
                logger.info("received hashtag 'everyone'");
                /*db.getSetting('everyone', msg.chat.id, () => {
                    db.notifyEveryone(bot, msg.from.id, msg.chat.id, msg)
                })*/
                break;
            case 'admin':
                logger.info("received hashtag 'admin'");
                /*db.getSetting('admin', msg.chat.id, () => {
                    bot.getChatAdministrators(msg.chat.id).then((admins) => {
                        admins.forEach((admin) => {
                            db.notifyUser(bot, admin.user.id, msg, false)
                        })
                    })
                })*/
                break;
            default:
                break
        }
    }

    private async notifyUser(chat: Chat, username: string, message: any, userRepository: Repository<User>, groupRepository: Repository<Group>) {
        logger.debug("notifying", {user: username, message: message, chat: chat});
        const user = await userRepository.createQueryBuilder("user")
            .leftJoin("user.groups", "group" )
            .where("user.username = :username", {username: username})
            .andWhere("group.groupId = :groupId", {groupId: chat.id})
            .getOne();
        console.log("Notifying\n", user);

    }
}

export {TagAlertBot};


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
