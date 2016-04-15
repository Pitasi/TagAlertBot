# TagAlertBot
Telegram bot that notifies users when they are tagged in groups, 
with advanced features and multi-language support.

You can freely user the bot already running: @TagAlertBot (http://telegram.me/tagalertbot)

Written in Python 3 and powered by
[pyTelegramBotAPI](https://github.com/eternnoir/pyTelegramBotAPI).

Support my project and keeping up the server by donating 50 cents: http://paypal.me/pitasi.

This Readme file is a work in progress.

### Commands list
* /help - Show a presentation message.
* /enable - Enable notifications for the user.
* /disable - Disable notifications for the user.
* /retrieve - Search for the message inside the relative group.
* /ignore - Ignore notifications from a specific user.
* /unignore - Unignore notifications from a specific user.
* /setlang - 
* /donate - 
* /sourcecode - 
* /feedback -
* /ban -
* /unban - 
* /stats -
* /credits

### Requirements
* Python 3
* * `sudo apt-get install python3 python3-dev`
* A Redis server __and__ his relative python's module
* * `sudo apt-get install redis`
* * `sudo pip3 install redis`
* pyTelegramBotAPI module
* * `sudo pip3 install pyTelegramBotAPI`
* Six module
* * `sudo pip3 install six`
* Three Telegram's bot tokens _(for main bot, log bot, and feedback bot)_
* * [How to obtain a token for telegram](http://google.it)
* 