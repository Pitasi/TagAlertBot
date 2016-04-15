from config import *

#############################################     
#                                           #     
#  LOADING...                               #     
#                                           #     
#############################################     
    
db = redis.Redis("localhost", decode_responses=True, db=2)

replies = {}
for l in lang_list:
    with open(l10n_folder+l+'.json') as f:
        replies[l] = json.load(f)


#############################################
#                                           #
#  STARTING THE BOT(s)                      #
#                                           #
#############################################

# Statistics:
global known_users
known_users = 0
global enabled_users
enabled_users = 0

for k in db.scan_iter():
    try:
        if db.hget(k, "enabled") == "True":
            enabled_users+= 1
        known_users+= 1
    except Exception:
        pass

# Main bot initializing...
bot = telebot.TeleBot(main_bot_token)
bot.skip_pending = skip_pending

# Log bot initializing...
log_bot = telebot.TeleBot(log_bot_token)
log_bot.send_message(admin_id, "[%s]\n@%s is starting." % (strftime("%Y-%m-%d %H:%M:%S"), bot_name))

# Feedback bot initializing
feedback_bot = telebot.TeleBot(feedback_bot_token)


