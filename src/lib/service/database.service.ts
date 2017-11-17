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

    public applyAllMigrations(): void {
        logger.info("running SQL migrations");
        postgrator.migrate("max", (err: Error, migrations) => {
            if (err) {
                logger.error(err.message);
            } else {
                logger.info("successfully migrated database schema");
                logger.debug(migrations);
            }
            postgrator.endConnection(() => logger.debug("connection closed"));
        });
    }

}

export {DatabaseServiceImpl};
