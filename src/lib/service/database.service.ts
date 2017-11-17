import {injectable} from "inversify";
import * as postgrator from "postgrator";
import {logger} from "../logger";
import {IDatabaseService} from "../types/interfaces";
import * as dbconfig from "./../../../database.config";

@injectable()
class DatabaseServiceImpl implements IDatabaseService {
    public constructor() {
        postgrator.setConfig({
            migrationDirectory: dbconfig.migrations,
            schemaTable: "schema_version",
            driver: "pg",
            host: dbconfig.host,
            port: dbconfig.port,
            database: dbconfig.database,
            username: dbconfig.username,
            password: dbconfig.password,
        });
    }

    public applyAllMigrations(): Promise<void> {
        return new Promise((resolve, reject) => {
            logger.info("running SQL migrations");

            postgrator.migrate("max", (err: Error, migrations) => {
                if (err) {
                    postgrator.endConnection(() => logger.debug("connection closed"));
                    reject(err);
                } else {
                    logger.info("successfully migrated database schema");
                    logger.debug(migrations);
                    postgrator.endConnection(() => logger.debug("connection closed"));
                    resolve();
                }
            });
        });
    }

}

export {DatabaseServiceImpl};
