import {injectable} from "inversify";
import * as Postgrator from "postgrator";
import {logger} from "../logger";
import * as dbconfig from "./../../../migration.config";
import {Connection, createConnection, ObjectType, Repository} from "typeorm";
import {User} from "../entity/user";
import {Group} from "../entity/group";

@injectable()
export class DatabaseServiceImpl implements IDatabaseService {
    private postgrator: any;
    private connection: Promise<Connection>;

    public constructor() {
        /*this.postgrator = new Postgrator({
            migrationDirectory: dbconfig.migrations,
            schemaTable: "schema_version",
            driver: "pg",
            host: dbconfig.host,
            port: dbconfig.port,
            database: dbconfig.database,
            username: dbconfig.username,
            password: dbconfig.password,
        });
        logger.info("HEI");
        logger.info(dbconfig);
        this.postgrator.runQuery("SELECT 1").then(r => console.log("HEI2", r)).catch(e => {});
        this.postgrator.on('validation-started', migration => logger.info(migration));
        this.postgrator.on('validation-finished', migration => logger.info(migration));
        this.postgrator.on('migration-started', migration => logger.info(migration));
        this.postgrator.on('migration-finished', migration => logger.info(migration));*/

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
            synchronize: true,
            logging: false
        });
    }

    public async applyAllMigrations(): Promise<boolean> {
        try {
            logger.info("running SQL migrations");
            const migrations = await this.postgrator.migrate();
            logger.debug(migrations);
            return true;
        } catch (e) {
            logger.error(e.message);
            logger.error(e.appliedMigrations);
            return false
        }

    }

    public getRepository(entity: ObjectType<Entity>): Promise<Repository<Entity>> {
        return new Promise((resolve, reject) => {
            this.connection.then(connection => {
                resolve(connection.getRepository(entity));
            }).catch(reject);
        })
        // return this.connection.getRepository(entity);
    }

}

