/****************************************************/
//   TagAlertBot (https://t.me/tagalertbot)         //
//   Simple notifications bot for mentions          //
//                                                  //
//   Author: Antonio Pitasi (@Zaphodias)            //
//   2016 - made with love                          //
/****************************************************/

import "reflect-metadata";
import {TYPES} from "./lib/types/types";
import {container} from "./lib/inversify.config";
import {IBot} from "./lib/types/interfaces";

const bot = container.get<IBot>(TYPES.Bot);
bot.start();
