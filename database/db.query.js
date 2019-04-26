let mysql = require('mysql'),
    mysqlConfig = require('./db.config');

module.exports = {

    /**
     * 操作数据库需要使用异步
     * @param sql {String}
     */
    query: (sql, params = []) => {
        //返回一个promise
        return new Promise((resolve, reject) => {
            let connection = mysql.createConnection(mysqlConfig);

            //连接数据库
            connection.connect((error) => {
                if (error) {
                    console.log('数据库连接失败');
                    throw error;
                }
            });

            connection.query(sql, params, (error, result) => {
                if (error) {
                    console.log('操作数据库失败', sql);
                    throw error;
                }

                resolve(result);

                //操作完后就关闭数据库，放在执行完毕后避免多次操作数据库遇到数据库关闭导致执行失败
                connection.end((error) => {
                    if (error) {
                        console.log('数据库关闭失败');
                        throw error;
                    }
                });
            });
        });
    }
};