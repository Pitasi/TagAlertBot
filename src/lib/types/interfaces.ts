import {ObjectType, Repository} from "typeorm";

interface IBot {
    start(): void;
}

interface IDatabaseService {
    applyAllMigrations(): Promise<boolean>;
    getRepository(entity: ObjectType<Entity>): Repository<Entity>;
}
