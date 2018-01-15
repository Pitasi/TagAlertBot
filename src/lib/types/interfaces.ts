import {ObjectType, Repository} from "typeorm";

export interface IBot {
    start(): void;
}

export interface IDatabaseService {
    applyAllMigrations(): Promise<boolean>;
    getRepository(entity: ObjectType<any>): Promise<Repository<any>>;
}

export interface IAntifloodService {
    isFlooding(userId: string): boolean;
}
