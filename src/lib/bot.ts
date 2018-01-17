///<reference path="util/config.util.ts"/>
import {inject, injectable} from "inversify";
import {TYPES} from "./types/types";
import * as Telegraf from 'telegraf';
import * as Extra from "telegraf/extra.js"
import * as Markup from "telegraf/markup.js"
import {IAntifloodService, IBot, IDatabaseService} from "./types/interfaces";
import {ConfigurationLoader} from "./util/config.util";
import * as path from "path";
import {User} from "./entity/user";
import {Repository} from "typeorm";
import {Group} from "./entity/group";
import {CallbackQuery, Message, MessageEntity, User as TgUser} from 'telegram-typings'
import Optional from "typescript-optional";
import * as winston from "winston";
import * as memoize from 'memoizee';
import * as util from 'util';
import {loadYaml, sanitize} from "./util/functions.util";

@injectable()
class TagAlertBot implements IBot {
    private databaseService: IDatabaseService;
    private antifloodService: IAntifloodService;
    private bot: any;
    private config: ConfigurationLoader;
    private strings: any;
    private logger: winston.Winston;
    private DEBUG: boolean = false;

    public constructor(@inject(TYPES.DatabaseService) databaseService: IDatabaseService,
                       @inject(TYPES.AntifloodService) antifloodService: IAntifloodService,
                       @inject(TYPES.ConfigurationLoader) configurationLoader: ConfigurationLoader,
                       @inject(TYPES.Logger) logger: winston.Winston) {
        this.databaseService = databaseService;
        this.antifloodService = antifloodService;
        this.config = configurationLoader;
        this.logger = logger;
        this.strings = loadYaml(path.resolve(__dirname, "..", "resources", "replies.yml"))
    }

    public async start() {
        try {
            this.DEBUG = await this.config.load('debug') || false;
            if (this.DEBUG) this.logger.info("DEBUG MODE - TagAlertBot is running in debug mode");

            const done = await this.databaseService.applyAllMigrations();
            if (done) {
            } else {
                this.logger.error("Something went wrong applying migrations.");
                process.exit(1);
            }
            const userRepository: Repository<User> = await this.databaseService.getRepository(User);
            const groupRepository: Repository<Group> = await this.databaseService.getRepository(Group);

            await this.bootstrap({userRepository: userRepository, groupRepository: groupRepository});

            this.logger.info("starting TagAlertBot");
            this.bot.startPolling();
        } catch (e) {
            this.logger.error(e);
        }
    }

    private async bootstrap(params: { userRepository: Repository<User>, groupRepository: Repository<Group> }) {
        const token = await this.config.load("bot.token");
        this.bot = new Telegraf(token);
        this.bot.use((ctx, next) => {
            ctx.cache = {
                getChatMember: memoize(ctx.getChatMember, {promise: 'then', maxAge: 24 * 60 * 60 * 1000})
            };
            return next(ctx);
        });
        await this.registerSelf();
        await this.registerCommands(params.userRepository, params.groupRepository);
        await this.registerOnMessage(params.userRepository, params.groupRepository);
        await this.registerOnCallbackQuery();

    }

    private async registerSelf() {
        try {
            const botInfo: TgUser = await this.bot.telegram.getMe();
            this.logger.debug("bot informations:\n", JSON.stringify(botInfo, null, 2));
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
            const chat = message.chat;
            if (chat.type !== 'private') {
                const sender = await userRepository.findOneById(from.id);
                const group = Optional.ofNullable(await groupRepository.findOneById(chat.id))
                    .orElse(new Group(
                        chat.id,
                        chat.username,
                        chat.type,
                        chat.all_members_are_administrators));
                if (sender != undefined) group.users.push(sender);

                await groupRepository.save(group);
                this.logger.info("started in new group", group);
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
            const message: Message = ctx.message;
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
                    if (!this.isEqual(from.username, username) && !this.isEqual(this.bot.options.username, username) || this.DEBUG) {
                        await this.notifyUser(ctx, username, userRepository, groupRepository);
                    }
                })
                // bot.cachedGetChatMember.delete(msg.chat.id, msg.from.id) // ensure we remove the cache for this user
            }


        })
    }

    private async registerOnCallbackQuery() {
        try {
            this.bot.on('callback_query', async (ctx) => {
                const query: CallbackQuery = ctx.callbackQuery;
                const from = query.from;
                if (!this.antifloodService.isFlooding(from.id)) {
                    const data = query.data;
                    switch (data) {
                        case 'admin':
                        case 'everyone':
                            this.logger.info("Hashtags are not enabled yet");
                            break;
                        default:
                            if (!(data.length > 0) || !(data.includes("_") || data.split("_").length < 3)) {
                                this.logger.error("Invalid callback_query data", {
                                    data: data,
                                    from_id: from.id,
                                    from_username: from.username
                                });
                                return;
                            }
                            const splitted = data.split("_");
                            switch (splitted[0]) {
                                case '/retrieve':
                                    const messageId = splitted[1];
                                    const groupId = splitted[2];

                                    const keyboard = Markup.inlineKeyboard([
                                        Markup.callbackButton(this.strings.en.done, `/delete_${from.id}`)
                                    ]).extra();
                                    const options = Object.assign(keyboard, {reply_to_message_id: parseInt(messageId)});
                                    const sent = await ctx.telegram.sendMessage(
                                        -parseInt(groupId),
                                        util.format(
                                            this.strings.en.retrieve_group,
                                            from.username ? '@' + from.username : from.first_name,
                                            from.id
                                        ),
                                        options
                                    );
                                    this.logger.info("Answered /retrieved callback_query", {
                                        sent_message: sent.message_id,
                                        retrieved_message_id: messageId,
                                        group_id: groupId,
                                        user: from.username,
                                        user_id: from.id,
                                        options: JSON.stringify(options)
                                    });
                                    await ctx.answerCbQuery(this.strings.en.retrieve_success, false);
                                    break;
                                case '/delete':
                                    if (query.from.id === parseInt(splitted[1])) {
                                        const message = query.message;
                                        await ctx.telegram.deleteMessage(message.chat.id, message.message_id);
                                        this.logger.info("Deleted message", {
                                            user: from.username,
                                            user_id: from.id,
                                            deleted_message: message.message_id,
                                            from_chat: message.chat.id
                                        });
                                    } else {
                                        this.logger.warn("User tried to delete message not from self", {
                                            user: from.username,
                                            user_id: from.id,
                                            parsed_id: parseInt(splitted[1])
                                        });
                                        const sent = await ctx.reply(this.strings.en.wrong_delete);
                                    }
                                    break;
                                default:
                                    this.logger.error("Invalid callback_query data", {
                                        data: data,
                                        from_id: from.id,
                                        from_username: from.username
                                    });
                            }
                            break;
                    }
                } else {
                    ctx.answerCbQuery(this.strings.en.flooding, true);
                }
            });
        } catch (e) {
            this.logger.error(e.message);
            this.logger.debug(e.stack);
        }
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
                this.logger.debug("processing caption for ", {usernames: matched}, "message:", message);
                const username = matched[i].trim().substring(1).toLowerCase();
                toBeNotified.add(username);
            }
        }
    }

    private handleMentions(toBeNotified: Set<String>, message: Message, entity: MessageEntity) {
        const username = this.extract(message, entity);
        this.logger.debug("processing", {mention: username}, "message:", message);
        toBeNotified.add(username);
    }

    private handleHashtags(message: Message, entity: MessageEntity) {
        const hashtag = this.extract(message, entity);
        this.logger.debug("processing", {hashtag: hashtag}, "message:", message);
        switch (hashtag) {
            case 'everyone':
                this.logger.info("received hashtag 'everyone'");
                /*db.getSetting('everyone', msg.chat.id, () => {
                    db.notifyEveryone(bot, msg.from.id, msg.chat.id, msg)
                })*/
                break;
            case 'admin':
                this.logger.info("received hashtag 'admin'");
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

    private async notifyUser(ctx: any, username: string, userRepository: Repository<User>, groupRepository: Repository<Group>, silent: boolean = false) {
        try {
            const message = ctx.message as Message;
            const from = message.from;
            const chat = message.chat;
            if (this.isEqual(username, this.bot.options.username)) {
                this.logger.warn(`User ${from.username || from.id} tagged the bot`, {
                    chat_username: chat.username,
                    chat_title: chat.title,
                    chat_id: chat.id,
                    message: message.text,
                    message_id: message.message_id
                });
                return;
            }
            this.logger.debug("notifying", {
                user: username,
                chat_id: chat.id,
                chat_title: chat.title,
                chat_username: chat.username
            });
            const user = await userRepository.findOne({where: {username: username}, select: ["id"]});
            if (!user) {
                this.logger.debug("User has never activated the bot. Ignoring mention.", {
                    user: username,
                    from: from.username,
                    from_id: from.id,
                    chat_username: chat.username,
                    chat_title: chat.title,
                    chat_id: chat.id
                });
                return;
            }
            const member = await ctx.cache.getChatMember(user.id);
            if (member.status === 'left' || member.status === 'kicked') {
                this.logger.info("User has left the group or has been kicked. Will not be notified.",
                    {group: chat.id, user: member.user});
                return;
            } else {
                const fromMessage = util.format('%s %s %s',
                    from.first_name,
                    from.last_name ? from.last_name : '',
                    from.username ? `(@${from.username})` : ''
                );

                const button = Markup.button(this.strings.en.retrieve);

                if (chat.username) {
                    button.url = `telegram.me/${chat.username}/${message.message_id}`
                } else {
                    button.callback_data = `/retrieve_${message.message_id}_${-chat.id}`
                }

                const keyboard = Markup.inlineKeyboard([button]);

                if (message.photo) {
                    const tempMsg = util.format(this.strings.en.main_caption, sanitize(fromMessage), sanitize(chat.title), sanitize(message.caption));
                    const fileId = message.photo[0].file_id;
                    const finalMessage = tempMsg.length > 200 ? tempMsg.substr(0, 197) + '...' : tempMsg;
                    const sent: Message = await ctx.telegram.sendPhoto(user.id, fileId, Object.assign(keyboard.extra(), {caption: finalMessage}));
                    this.logger.info("Notified user with photo", {
                        user: username,
                        sent_message: sent.message_id,
                        target_message: message.message_id
                    });
                    this.logger.info("SendPhoto", {res: sent});
                } else {
                    const finalMessage = util.format(this.strings.en.main_text, sanitize(fromMessage), sanitize(chat.title), sanitize(message.text));
                    const sent: Message = await ctx.telegram.sendMessage(user.id, finalMessage,
                        Object.assign(keyboard.extra(), {
                            parse_mode: 'HTML',
                            disable_notification: silent
                        }));
                    this.logger.info("Notified user with text message", {
                        user: username,
                        sent_message: sent.message_id,
                        target_message: message.message_id
                    });
                }

            }
        } catch (e) {
            this.logger.error(e.message);
            this.logger.debug(e.stack);
        }
    }
}

export {TagAlertBot};

/*
if (!af.isFlooding(call.from.id)) {
        switch (call.data) {
            case 'admin':
            case 'everyone':
                bot.getChatAdministrators(call.message.chat.id).then((admins) => {
                    admins.forEach((admin) => {
                        if (call.message.chat.all_members_are_administrators || admin.user.id === call.from.id)
                            return db.updateSettings(call.data, call.message.chat.id, (setting, status) => {
                                bot.answerCallbackQuery(
                                    call.id, util.format(replies.settings_updated, '#' + setting, status ? 'enabled' : 'disabled'), true)
                            })

                    })
                })
                break

            default:
                let splitted = call.data.split('_')
                switch (splitted[0]) {
                    case '/retrieve':
                        let messageId = splitted[1]
                        let groupId = splitted[2]
                        bot.sendMessage(
                            -parseInt(groupId),
                            util.format(replies.retrieve_group, call.from.username ? '@' + call.from.username : call.from.first_name, call.from.id),
                            {
                                reply_to_message_id: parseInt(messageId),
                                reply_markup: {
                                    inline_keyboard: [[{
                                        text: replies.done,
                                        callback_data: `/delete_${call.from.id}`
                                    }]]
                                }
                            }
                        ).then((m) => {
                            if (config.msg_timeout < 1) return;
                            setTimeout(() => {
                                bot.deleteMessage(m.message_id, m.chat.id).then(() => {
                                }).catch(() => {
                                })
                            }, config.msg_timeout * 1000)
                        })
                        bot.sendMessage(
                            call.from.id,
                            replies.retrieve_success + '\n\n' + util.format(replies.retrieve_hashtag, call.from.id),
                            {reply_to_message_id: call.message.message_id}
                        )
                        bot.answerCallbackQuery(call.id, replies.retrieve_success, false)
                        break

                    case '/delete':
                        if (call.from.id === parseInt(splitted[1])) bot.deleteMessage(call.message.message_id, call.message.chat.id)
                }
                break
        }
    }
    else bot.answerCallbackQuery(call.id, replies.flooding, true)
 */
