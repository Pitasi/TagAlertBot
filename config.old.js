/* REQUIRED PARAMETERS    */
/* - TELEGRAM_TOKEN       */
/* - POSTGRES DB URL      */

/* OPTIONAL PARAMETERS    */
/* - ADMIN_ID             */
/* - ANTIFLOOD_TOLERANCE  */
/* - WEBHOOK_URL          <-- currently disabled! */  
/* - WEBHOOK_PORT         */
/* - MSG_TIMEOUT          */
/*    (0 to disable)      */

/* --- --- --- --- --- -- */

const token = process.env.BOT_TOKEN
if (!token) throw Error('Provide a valid Telegram token as environment variable.\nEx: \x1b[4m\x1b[32mBOT_TOKEN=xxx npm start\x1b[0m\n')

const url = process.env.DATABASE_URL
if (!url) throw Error('Provide a valid Postgres database url as environment variable.\nEx: \x1b[4m\x1b[32mBOT_TOKEN=xxx DATABASE_URL=progres://user:pw@127.0.0.1:5432/tagalert npm start\x1b[0m\n')
const db_url = require('url').parse(url)
const auth = db_url.auth.split(':')

const admin_id  = process.env.ADMIN_ID || null
const antiflood  = parseInt(process.env.ANTIFLOOD_TOLERANCE) || 2
if (antiflood < 2) throw new Error('Antiflood tolerance minimum is 2.\n')

const msg_timeout = parseInt(process.env.MSG_TIMEOUT) || 25

module.exports = {
    // database settings - a postgre database is REQUIRED!
    'database': {
      user: auth[0],
      password: auth[1],
      host: db_url.hostname,
      port: db_url.port,
      database: db_url.pathname.split('/')[1],
      ssl: false,
      max: 30,
      min: 6,
      idleTimeoutMillis: 1000
    },

    // telegram token (contact @BotFather for getting one)
    'token': token,

    // your admin id (contact @userinfobot to get yours)
    'adminId': admin_id,

    // flooding tolerance (higher = more flood), tune it as you prefer but never below 2
    'antiflood': antiflood,

    // timeout for deleting group messages in seconds
    'msg_timeout': msg_timeout
}
