import {injectable} from "inversify";
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

    public mapUsers(rows: any[]): Promise<User[]> {
        return new Promise((resolve, reject) => {
            const users: User[] = [];
            for (const row in Object.keys(rows)) {
                this.mapUser(row)
                    .then(users.push)
                    .catch(reject);
            }
            resolve(users);
        });
    }

}
