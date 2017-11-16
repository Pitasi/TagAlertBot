import "reflect-metadata";
import {Container} from "inversify";
import {TagAlertBot} from "./bot";
import {DatabaseServiceImpl} from "./service/database.service";
import {TYPES} from "./types/types";

const container = new Container();

container.bind<IBot>(TYPES.Bot).to(TagAlertBot);
container.bind<IDatabaseService>(TYPES.DatabaseService).to(DatabaseServiceImpl);

export {container};
