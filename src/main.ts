/****************************************************/
//   TagAlertBot (https://t.me/tagalertbot)         //
//   Simple notifications bot for mentions          //
//                                                  //
//   Author: Antonio Pitasi (@Zaphodias)            //
//   2016 - made with love                          //
/****************************************************/

import {TYPES} from "./lib/types/types";

// require('./libs/bot.js');
import {container} from "./lib/inversify.config";

const bot = container.get<IBot>(TYPES.Bot);
bot.start();
