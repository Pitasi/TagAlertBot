///<reference path="util/config.util.ts"/>
import {inject, injectable} from "inversify";
import {TYPES} from "./types/types";
import * as Telegraf from 'telegraf';
import * as Extra from "telegraf/extra.js"
import {IAntifloodService, IBot, IDatabaseService} from "./types/interfaces";
import {ConfigurationLoader, loadYaml} from "./util/config.util";
import * as path from "path";
import {User} from "./entity/user";
import {Repository} from "typeorm";
import {Group} from "./entity/group";
import {Message, MessageEntity, User as TgUser} from 'telegram-typings'
import Optional from "typescript-optional";
import * as winston from "winston";
import * as memoize from 'memoizee';
import * as util from 'util';

@injectable()
class TagAlertBot implements IBot {
    private databaseService: IDatabaseService;
    private antifloodService: IAntifloodService;
    private bot: any;
    private config: ConfigurationLoader;
    private strings: any;
    private logger: winston.Winston;

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
                    /*if (!isEqual(msg.from.username, username) || DEBUG) {
                        db.notifyUser(bot, username, msg, false)
                    }*/

                    if (!this.isEqual(from.username, username)) {
                        await this.notifyUser(ctx, username, null, userRepository, groupRepository);
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

    private async notifyUser(ctx: any, username: string, userRepository: Repository<User>, groupRepository: Repository<Group>) {
        const message = ctx.message as Message;
        const from = message.from;
        this.logger.debug("notifying", {user: username, chat: message.chat});
        const user = await userRepository.findOne({where: {username: username}, select: ["id"]});
        const member = await ctx.cache.getChatMember(user.id);
        if (member.status === 'left' || member.status === 'kicked'
            || member.status === 'member') { // this one should be removed
            this.logger.info("User has left the group or has been kicked. Will not be notified.",
                {group: message.chat.id, user: member.user});
            return;
        } else {
            const fromMessage = util.format('%s %s %s',
                from.first_name,
                from.last_name ? from.last_name : '',
                from.username ? `(@${from.username})` : ''
            );


        }
    }
}

export {TagAlertBot};

/*
if (res.status == 'left' || res.status == 'kicked') return
                // User is inside in the group
                var from = util.format('%s %s %s',
                    msg.from.first_name,
                    msg.from.last_name ? msg.from.last_name : '',
                    msg.from.username ? `(@${msg.from.username})` : ''
                )
                var btn = {inline_keyboard: [[{text: replies.retrieve}]]}
                if (msg.chat.username)
                    btn.inline_keyboard[0][0].url = `telegram.me/${msg.chat.username}/${msg.message_id}`
                else
                    btn.inline_keyboard[0][0].callback_data = `/retrieve_${msg.message_id}_${-msg.chat.id}`

                if (msg.photo) {
                    let final_text = util.format(replies.main_caption, sanitize(from), sanitize(msg.chat.title), sanitize(msg.caption))
                    const file_id = msg.photo[0].file_id
                    if (final_text.length > 200) final_text = final_text.substr(0, 197) + '...'
                    bot.sendPhoto(userId, file_id, {caption: final_text, reply_markup: btn})
                }
                else {
                    let final_text = util.format(replies.main_text, sanitize(from), sanitize(msg.chat.title), sanitize(msg.text))
                    bot.sendMessage(userId,
                        final_text,
                        {
                            parse_mode: 'HTML',
                            reply_markup: btn,
                            disable_notification: silent
                        })
                }
 */
