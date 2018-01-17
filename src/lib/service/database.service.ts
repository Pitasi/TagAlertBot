import {inject, injectable} from "inversify";
import * as Postgrator from "postgrator";
import {Connection, createConnection, ObjectType, Repository} from "typeorm";
import {User} from "../entity/user";
import {Group} from "../entity/group";
import {IDatabaseService} from "../types/interfaces";
import {ConfigurationLoader} from "../util/config.util";
import {TYPES} from "../types/types";
import * as path from "path";
import * as winston from "winston";

@injectable()
export class DatabaseServiceImpl implements IDatabaseService {
    private postgrator: any;
    private connection: Promise<Connection>;
    private logger: winston.Winston;

    public constructor(@inject(TYPES.ConfigurationLoader) configurationLoader: ConfigurationLoader,
                       @inject(TYPES.Logger) logger: winston.Winston) {
        this.logger = logger;
        const dbconfig = configurationLoader.loadSync("bot.db");
        const migrationDirectory = path.resolve(__dirname, "..", "..", dbconfig.migrations);
        const postgratorOpts = {
            migrationDirectory: migrationDirectory,
            schemaTable: "schema_version",
            driver: "pg",
            host: dbconfig.host,
            port: dbconfig.port,
            database: dbconfig.database,
            username: dbconfig.username,
            password: dbconfig.password,
        };

        this.postgrator = new Postgrator(postgratorOpts);
        this.postgrator.on('validation-started', migration => this.logger.info("validating migration", {
            version: migration.version,
            name: migration.name
        }));
        this.postgrator.on('validation-finished', migration => this.logger.info("validated migration", {
            version: migration.version,
            name: migration.name
        }));
        this.postgrator.on('migration-started', migration => this.logger.info("starting migration", {
            version: migration.version,
            name: migration.name
        }));
        this.postgrator.on('migration-finished', migration => this.logger.info("finishing migration", {
            version: migration.version,
            name: migration.name
        }));
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
            this.logger.info("running SQL migrations");
            await this.postgrator.migrate();
            return true;
        } catch (e) {
            this.logger.debug(e);
            this.logger.error(`${e.message}\n${e.appliedMigrations}`);
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

