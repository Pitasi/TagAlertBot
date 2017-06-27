const db = require('./database.js')

module.exports = {
  sendMessage: (req, res) => (db.logAction('sendMessage', req, res)),
  getChatMember: (req, res) => (db.logAction('getChatMember', req, res)),
}
