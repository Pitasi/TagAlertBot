import {Pool} from "pg";
import {logger} from "../logger";
import {IConnectionParameters} from "../types/interfaces";

export class ConnectionFactory {
    public static createConnectionPool(params: IConnectionParameters): any {
        logger.debug("created new connection pool");
        return new Pool(params);
    }
}
