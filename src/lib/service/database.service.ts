import {injectable} from "inversify";
import * as Postgrator from "postgrator";
import {logger} from "../logger";
import * as dbconfig from "../../resources/database.config.js";
import {Connection, createConnection, ObjectType, Repository} from "typeorm";
import {User} from "../entity/user";
import {Group} from "../entity/group";
import {IDatabaseService} from "../types/interfaces";

@injectable()
export class DatabaseServiceImpl implements IDatabaseService {
    private postgrator: any;
    private connection: Promise<Connection>;

    public constructor() {
        const postgratorOpts = {
            migrationDirectory: dbconfig.migrations,
            schemaTable: "schema_version",
            driver: "pg",
            host: dbconfig.host,
            port: dbconfig.port,
            database: dbconfig.database,
            username: dbconfig.username,
            password: dbconfig.password,
        };

        this.postgrator = new Postgrator(postgratorOpts);
        this.postgrator.on('validation-started', migration => logger.info("validating migration", { version: migration.version, name: migration.name }));
        this.postgrator.on('validation-finished', migration => logger.info("validated migration", { version: migration.version, name: migration.name }));
        this.postgrator.on('migration-started', migration => logger.info("starting migration", { version: migration.version, name: migration.name }));
        this.postgrator.on('migration-finished', migration => logger.info("finishing migration", { version: migration.version, name: migration.name }));
        this.connection = createConnection({
            type: "postgres",
            host: dbconfig.host,
            port: dbconfig.port,
            username: dbconfig.username,
            password: dbconfig.password,
            database: dbconfig.database,
            entities: [
                User,
                Group
            ],
            synchronize: false,
            logging: false
        });
    }

    public async applyAllMigrations(): Promise<boolean> {
        try {
            logger.info("running SQL migrations");
            await this.postgrator.migrate();
            return true;
        } catch (e) {
            logger.debug(e);
            logger.error(`${e.message}\n${e.appliedMigrations}`);
            return false
        }

    }

    public getRepository(entity: ObjectType<any>): Promise<Repository<any>> {
        return new Promise((resolve, reject) => {
            this.connection.then(connection => {
                const repository = connection.getRepository(entity);
                resolve(repository);
            }).catch(reject);

        })
        // return this.connection.getRepository(entity);
    }

}

