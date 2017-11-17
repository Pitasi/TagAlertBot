/****************************************************/
//   TagAlertBot (https://t.me/tagalertbot)         //
//   Simple notifications bot for mentions          //
//                                                  //
//   Author: Antonio Pitasi (@Zaphodias)            //
//   2016 - made with love                          //
/****************************************************/

// require('./libs/bot.js');
import {container} from "./lib/inversify.config";
import {IBot} from "./lib/types/interfaces";
import {TYPES} from "./lib/types/types";

const bot = container.get<IBot>(TYPES.Bot);
bot.start();
