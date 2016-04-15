# TagAlertBot
Telegram bot that notifies users when they are tagged in groups, 
with advanced features and multi-language support.

You can freely user the bot already running: @TagAlertBot (http://telegram.me/tagalertbot)

Written in Python 3 and powered by
[pyTelegramBotAPI](https://github.com/eternnoir/pyTelegramBotAPI).

Support my project and keeping up the server by donating 50 cents: http://paypal.me/pitasi.

This Readme file is a work in progress.

### Commands available

| Command           | Description                                           |
| ----------------- | ----------------------------------------------------- |
| /help             | Show a presentation message.                          |
| /enable           | Enable notifications for the user.                    |
| /disable          | Disable notifications for the user.                   |
| /retrieve_[CODE]  | Search for the message inside the relative group.     |
| /ignore_[CODE]    | Ignore notifications from a specific user.            |
| /unignore_[CODE]  | Unignore notifications from a specific user.          |
| /groups           | Show a list of groups in which user is known          |
| /setlang          | Show a list of available languages                    |
| /donate           | Show a PayPal link for donating to dev                |
| /sourcecode       | Show a link to this repository                        |
| /feedback         | Send a message to dev through the Feedback Bot        |
| /ban [ID]         | Ban an user from using the bot (admin only)           |
| /unban [ID]       | Unban an user                                         |
| /stats            | Show some statistics                                  |
| /credits          | Show credits for bot and translations                 |

### Requirements
* Python 3

`sudo apt-get install python3 python3-dev`

* A Redis server __and__ his relative python's module

`sudo apt-get install redis`

`sudo pip3 install redis`

* pyTelegramBotAPI module

`sudo pip3 install pyTelegramBotAPI`

* Six module

`sudo pip3 install six`

* Three Telegram's bot tokens _(for main bot, log bot, and feedback bot)_

[How to obtain a token for telegram](https://unnikked.ga/getting-started-with-telegram-bots/)
 
