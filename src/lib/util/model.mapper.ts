import {injectable} from "inversify";
import {User} from "../model/user";
import {IModelMapper} from "../types/interfaces";

@injectable()
export class ModelMapper implements IModelMapper {
    public mapUser(row: any): Promise<User> {
        return new Promise((resolve, reject) => {
            if (row.hasOwnProperty("id") && row.hasOwnProperty("username")) {
                const user = new User(row.id, row.username);
                resolve(user);
            } else {
                reject(new Error("cannot map a row without 'id' and 'username' column to user"));
            }
        });
    }

    public async mapUsers(rows: any[]): Promise<User[]> {
        const users: User[] = [];
        for (const i in Object.keys(rows)) {
            try {
                const user = await this.mapUser(rows[i]);
                users.push(user);
            } catch (e) {
                throw e;
            }
        }
        return users;
    }

}
