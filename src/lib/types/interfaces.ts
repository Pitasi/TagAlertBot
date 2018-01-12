import {ObjectType, Repository, Entity} from "typeorm";

export interface IBot {
    start(): void;
}

export interface IDatabaseService {
    applyAllMigrations(): Promise<boolean>;
    getRepository(entity: ObjectType<any>): Promise<Repository<any>>;
}
