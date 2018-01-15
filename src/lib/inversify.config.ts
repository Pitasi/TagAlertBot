import "reflect-metadata"; // IMPORTANT This should always be first. ALWAYS
import {Container} from "inversify";
import {TagAlertBot} from "./bot";
import {DatabaseServiceImpl} from "./service/database.service";
import {IAntifloodService, IBot, IDatabaseService} from "./types/interfaces";
import {TYPES} from "./types/types";
import AntiFoodServiceImpl from "./service/antiflood.service";

const container = new Container();

container.bind<IBot>(TYPES.Bot).to(TagAlertBot);
container.bind<IDatabaseService>(TYPES.DatabaseService).to(DatabaseServiceImpl);
container.bind<IAntifloodService>(TYPES.AntifloodService).to(AntiFoodServiceImpl);

export {container};
