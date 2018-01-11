import "reflect-metadata"; // IMPORTANT This should always be first. ALWAYS
import {Container} from "inversify";
import {TagAlertBot} from "./bot";
import {DefaultUserRepository} from "./repository/user.repository";
import {DatabaseServiceImpl} from "./service/database.service";
import {IBot, IDatabaseService, IModelMapper, IUserRepository} from "./types/interfaces";
import {TYPES} from "./types/types";
import {ModelMapper} from "./util/model.mapper";

const container = new Container();

container.bind<IBot>(TYPES.Bot).to(TagAlertBot);
container.bind<IDatabaseService>(TYPES.DatabaseService).to(DatabaseServiceImpl);
container.bind<IUserRepository>(TYPES.UserRepository).to(DefaultUserRepository);
container.bind<IModelMapper>(TYPES.ModelMapper).to(ModelMapper);

export {container};
