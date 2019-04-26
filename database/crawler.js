/**
 * @author shuizhubocai@gmail.com
 * @date 2019/4/26
 * @Description: 数据库爬虫
*/

let request = require('request'), //http库
    cheerio = require('cheerio'),//类Jquery解析DOM
    util = require('util'),//工具库
    url = require('url'), //处理url
    fs = require('fs'), //处理文件
    path = require('path'), //处理路径
    db = require('./db.query'); //操作数据库

//下载器
class Download {

    /**
     * 下载url页面
     * @param newUrl {String}
     */
    download(newUrl) {

        let _options = {
            url: newUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.103 Safari/537.36',
                'Referer': 'https://maoyan.com'
            }
        };

        //返回一个promise
        return new Promise((resolve, reject) => {
            request(_options, (error, response, body) => {
                if (error) {
                    reject(error);
                } else {
                    if (response.statusCode == 200) {
                        console.log(util.format('正在抓取地址：%s', newUrl));
                        resolve(body);
                    }
                }
            });
        });
    }
}

//解析器
class Parser {

    /**
     * 解析html
     * @param newUrl {String}
     * @param html {String}
     */
    parserHTML(newUrl, html) {
        let datas, urls, $;

        $ = cheerio.load(html);
        datas = this.getDatas(newUrl, $);
        urls = this.getUrls(newUrl, $);

        return {datas, urls};
    }

    /**
     * 获取data
     * @param newUrl {String}
     * @param $
     * @returns {Array}
     */
    getDatas(newUrl, $) {
        let _headTarget = $('.movie-brief-container'),
            _headLiTargets = _headTarget.find('li'),
            _ContainerTarget = $('.tab-container'),
            _locationAndDuration = _headLiTargets.eq(1).text().replace(/[\r\n\s]/g, '').split('/');

        return {
            movie_title: _headTarget.find('.name').text(),
            movie_type: _headLiTargets.eq(0).text(),
            movie_show_date: _headLiTargets.eq(2).text().match(/^(\d{4}-\d{2}-\d{2}).*$/)[1],
            movie_introduction: _ContainerTarget.find('.dra').text(),
            movie_duration: _locationAndDuration[1],
            movie_location: _locationAndDuration[0]
        };
    }

    /**
     * 获取urls
     * @param url
     * @param $
     * @returns {Array}
     */
    getUrls(newUrl, $) {
        let _urls = [],
            _url;

        $('.movie-list dd').each((index, item) => {
            _url = $(item).find('.movie-item a').attr('href');
            if (/\/films\/\d+$/.test(_url)) {
                _urls.push(url.resolve(newUrl, _url));
            }
        });
        return _urls;
    }
}

//输出数据
class Output {

    /**
     * 存储data数据
     * @param datas {Array}
     */
    async storeDatas(datas) {
        //?表示占位符，后面datas值替换占位符
        await db.query('insert movie set ?', datas);
    }

    /**
     * 导出数据到html
     */
    async outputHTML() {
        let _datas, _html;

        //数据库里取出数据
        _datas = await db.query('select * from movie order by id asc');
        //用数据渲染html
        _html = _datas.map((item) => {
            return util.format('<div title="%s" style="margin-top:10px;">%s.<b style="margin-left:5px;">%s</b><span style="color:#999;margin-left:20px;">%s</span><span style="color:#999;margin-left:20px;">%s</span><span style="color:#999;margin-left:20px;">%s</span><span style="color:#999;margin-left:20px;">%s</span></div>', item.movie_introduction, item.id, item.movie_title, item.movie_duration, item.movie_show_date, item.movie_type, item.movie_location);
        });
        //对html添加额外的代码
        _html = util.format('<meta charset="utf-8"/>%s<br/>%s', new Date(), _html.join(''));
        //同步写入文件
        fs.writeFileSync(path.join(__dirname, '../output/output.html'), _html);
    }
}

//调度器
class Scheduler {

    //构造函数
    constructor() {
        this.download = new Download();
        this.parser = new Parser();
        this.output = new Output();
    }

    /**
     * 开始爬取
     * @param root_url {String}，爬取的入口url
     */
    async crawler(root_url) {

        let _counts, _popData, _maxCrawlerCounts = 20, _hasCrawlerCuonts = 0, _sleepFn, _sleepSecond = 3;

        /**
         * 暂停执行
         * @param second 暂停执行的秒数
         * @private
         */
        _sleepFn = (second) => {
            var _start = +new Date();
            while (+new Date - _start < second * 1000) {
            }
        };

        //添加一条数据到数据库************************1
        //先查询添加的root_url在数据库中的数量，status是0未爬取，是1已爬取
        _counts = (await db.query(util.format('select count(id) as counts from crawler_urls where movie_url = "%s" and status = 0', root_url)))[0].counts;
        //再没有数量就插入数据库
        if (!_counts) {
            await db.query(util.format('insert into crawler_urls(movie_url, status) values("%s", 0)', root_url));
        } else {
            console.log(util.format('入口地址%s已经爬取，请更换入口地址', root_url));
        }

        //查询数据库中没有爬取的url数量**********************2
        _counts = (await db.query('select count(id) as counts from crawler_urls where status = 0'))[0].counts;

        //遍历未爬取数据，设置爬取的阀值*************************3
        while (_counts > 0 && _hasCrawlerCuonts < _maxCrawlerCounts) {
            try {
                //从数据库取出一条未爬取的数据**************************4
                //顺序查询没有爬取的第一条数据的id，即status=0
                _popData = (await db.query('select * from crawler_urls where status = 0 order by id asc limit 1'))[0];
                //更新其status为1
                await db.query(util.format('update crawler_urls set status = 1 where id = %s', _popData.id));

                //下载页面****************************5
                let _html = await this.download.download(_popData.movie_url);

                //解析页面数据**************************6
                let {datas, urls} = this.parser.parserHTML(_popData.movie_url, _html);

                //存储datas数据**************************7
                //?表示占位符，后面datas值替换占位符
                await db.query('insert movie set ?', datas);

                //将urls加入数据库等待爬取********************8
                let _len = urls.length, _url;
                while (_len--) {
                    _url = urls[_len];
                    _counts = (await db.query(util.format('select count(id) as counts from crawler_urls where movie_url = "%s" and status = 0', _url)))[0].counts;
                    //再没有数量就插入数据库
                    if (!_counts) {
                        await db.query(util.format('insert into crawler_urls(movie_url, status) values("%s", 0)', _url));
                    } else {
                        //如果数据库有数据，再查询是否已经爬取，status=1
                        if (!(await db.query(util.format('select count(id) as counts from crawler_urls where movie_url = "%s" and status = 1', _url)))[0])
                        console.log(util.format('地址%s已经爬取', _url));
                    }
                }

                //查询未爬取数据的数量************************9
                _counts = (await db.query(util.format('select count(id) as counts from crawler_urls where movie_url = "%s"', _url)))[0].counts;
                //已爬取数量加1************************10
                _hasCrawlerCuonts++;
                //爬取一条数据后歇息几秒************************11
                _sleepFn(_sleepSecond);
            } catch (e) {
                //爬取失败其实还需要把爬取状态改会到0，这里就不改了
                console.log(util.format('%s爬取失败 ', _popData ? _popData.movie_url : ''));
            }
        }

        //输出html
        this.output.outputHTML();
    }
}

//实例化
crawler = new Scheduler();
crawler.crawler('https://maoyan.com/films/2');