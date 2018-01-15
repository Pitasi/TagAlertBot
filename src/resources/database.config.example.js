const dbconfig = {
    host: 'localhost',
    port: 5432, // optionally provide port
    database: 'tagalert',
    username: 'postgres',
    password: 'password',
    migrations: __dirname + '/migrations'
};

module.exports = dbconfig;
