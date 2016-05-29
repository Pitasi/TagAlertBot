#!/usr/bin/env python3

from config import *
from aux import *

error_message = "Sorry, the bot is offline due to maintenance.\nPlease try again in a few minutes."

@bot.message_handler(content_types=['text'])
def offline(message):
    if is_private(message):
        send_log(message)
        bot.send_message(message.chat.id, error_message)


bot.polling(none_stop=True)
