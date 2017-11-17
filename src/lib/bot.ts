import {inject, injectable} from "inversify";
import {logger} from "./logger";
import {User} from "./model/user";
import {IBot, IDatabaseService, IUserRepository} from "./types/interfaces";
import {TYPES} from "./types/types";

@injectable()
export class TagAlertBot implements IBot {
    private databaseService: IDatabaseService;
    private userRepository: IUserRepository;

    public constructor(@inject(TYPES.DatabaseService) databaseService: IDatabaseService,
                       @inject(TYPES.UserRepository) userRepository: IUserRepository) {
        this.databaseService = databaseService;
        this.userRepository = userRepository;
    }

    public async start() {
        logger.info("starting TagAlertBot");
        await this.databaseService.applyAllMigrations();
        const old = await this.userRepository.save(new User(24254235, "test"));
        const user = await this.userRepository.findOne("test");
        user.ifPresent((u) => logger.info(u.toString()));
    }
}

