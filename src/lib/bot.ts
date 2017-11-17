import {inject, injectable} from "inversify";
import {logger} from "./logger";
import {IBot, IDatabaseService} from "./types/interfaces";
import {TYPES} from "./types/types";

@injectable()
class TagAlertBot implements IBot {
    private databaseService: IDatabaseService;

    public constructor(@inject(TYPES.DatabaseService) databaseService: IDatabaseService) {
        this.databaseService = databaseService;
    }

    public start() {
        logger.info("starting TagAlertBot");
        this.databaseService.applyAllMigrations();
    }
}

export {TagAlertBot};
