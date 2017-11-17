import {inject, injectable} from "inversify";
import Optional from "typescript-optional";
import {isNullOrUndefined, isNumber} from "util";
import {IModelMapper, IUserRepository} from "../types/interfaces";
import {TYPES} from "../types/types";
import {ConnectionFactory} from "../util/connection.factory";
import * as dbconfig from "./../../../database.config";

@injectable()
export class DefaultUserRepository implements IUserRepository {
    private qFindAll: string = "SELECT * FROM users;";
    private qFindOneId: string = "SELECT * FROM users WHERE id = $1";
    private qFindOneUsername: string = "SELECT * FROM users WHERE username = $1";
    private qSave: string = "INSERT INTO users (id, username) VALUES ($1, $2);";
    private qDelete: string = "DELETE FROM users WHERE id = $1 AND  username = $2;";
    private pool: any;
    private modelMapper: IModelMapper;

    constructor(@inject(TYPES.ModelMapper) modelMapper: IModelMapper) {
        this.pool = ConnectionFactory.createConnectionPool({
            host: dbconfig.host,
            user: dbconfig.username,
            max: dbconfig.max || 20,
            idleTimeoutMillis: dbconfig.idleTimeoutMs || 30000,
            connectionTimeoutMillis: dbconfig.connectionTimeoutMs || 2000,
        });

        this.modelMapper = modelMapper;
    }

    public async findAll(): Promise<User[]> {
        const client = await this.clientSupplier();
        try {
            const res = await client.query(this.qFindAll);
            return await this.modelMapper.mapUsers(res.rows);
        } catch (e) {
            throw e;
        }
    }

    public async findOne(id: number | string): Promise<Optional<User>> {
        const query = typeof id === "number" ? this.qFindOneId : this.qFindOneUsername;
        return await this.find(query, [id]);
    }

    public async save(user: User): Promise<User> {
        if (isNullOrUndefined(user)) {
            throw new Error("cannot save or update a null user");
        } else {
            const client = await this.clientSupplier();
            try {
                client.query(this.qSave, [user.getId(), user.getUsername()]);
                return new User(user.getId(), user.getUsername());
            } catch (e) {
                throw e;
            }
        }
    }

    public async deleteEntry(user: number | User): Promise<boolean> {
        if (isNullOrUndefined(user)) {
            throw new Error("cannot delete a null user");
        } else {
            const client = await this.clientSupplier();
            try {
                const res = await client.query(this.findOne(isNumber(user) ? user : user.getId()));
                if (res.rows.length === 0) {
                    return false;
                } else {
                    client.query(this.qDelete, res.rows[0]);
                    return true;
                }
            } catch (e) {
                throw e;
            }
        }
    }

    private async find(query: string, params: any[]): Promise<Optional<User>> {
        const client = await this.clientSupplier();
        try {
            const res = await client.query(query, params);
            if (res.rows.length === 0) {
                return Optional.empty();
            } else {
                return Optional.ofNullable(await this.modelMapper.mapUser(res.rows[0]));
            }
        } catch (e) {
            throw e;
        }
    }

    private async clientSupplier(): Promise<any> {
        return await this.pool.connect();
    }
}
