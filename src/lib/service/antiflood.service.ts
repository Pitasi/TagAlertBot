import {User} from "../entity/user";
import {injectable} from "inversify";
import {IAntifloodService} from "../types/interfaces";
import {Message} from "telegram-typings";

/*function AntiFlood() {
    this.users = {}

    this.isFlooding = (userId) => {
        this.users[userId] = (this.users[userId] || 0) + 1
        return (this.users[userId] >= config.antiflood)
    }

    setInterval(() => {
        for (var i in this.users) {
            if (this.users[i] <= 0) delete this.users[i]
            else if (this.users[i] > 10) this.users[i] = 10
            else this.users[i]--
        }
    }, 4500)
}

module.exports = AntiFlood*/

@injectable()
export default class AntiFloodServiceImpl implements IAntifloodService {
    private users: User[];
    private messages: Object = {};

    constructor() {

    }

    public isBotFlooding(message: Message): boolean {
        const ms = `${message.chat.id}`;
        if (this.messages.hasOwnProperty(ms)) {
            for(let m of this.messages[ms]) {
                console.log("Messages", this.messages);
                return false;
            }
        } else {
            this.messages[ms][`${message.message_id}`] = message.date;
            return false;
        }
    }

    public isFlooding(userId: string | number): boolean {
        return false;
    }
}