/**
 * @author shuizhubocai@gmail.com
 * @date 2019/4/26
 * @Description: 本地爬虫
*/

let request = require('request'), //http库
    cheerio = require('cheerio'),//类Jquery解析DOM
    util = require('util'),//工具库
    url = require('url'), //处理url
    fs = require('fs'), //处理文件
    path = require('path'), //处理路径
    asyncOther = require('async'); //并发控制

//地址管理器
class Urls {

    //构造函数
    constructor() {
        //保存未爬取的url集合
        this.newUrls = new Set();
        //保存已爬取的url集合
        this.oldUrls = new Set();
    }

    /**
     * 从未爬取集合中取出一项
     * @returns {String}
     */
    getNewUrl() {
        //集合转数组取出第一项
        let _item = Array.from(this.newUrls)[0];
        this.newUrls.delete(_item);
        this.oldUrls.add(_item);
        return _item;
    }

    /**
     * 向未爬取集合中添加一项
     * @param newUrl {String}
     */
    addNewUrl(newUrl) {
        //如果url不在未爬取集合以及不在已爬取集合中，则添加
        if (!this.newUrls.has(newUrl) && !this.oldUrls.has(newUrl)) {
            this.newUrls.add(newUrl);
        }
    }

    /**
     * 向未爬取集合中添加多项
     * @param urls {Array}
     */
    addNewUrls(urls) {
        let _len = urls.length;

        while (_len--) {
            this.addNewUrl(urls[_len]);
        }
    }

    /**
     * 查看未爬取集合的大小
     */
    getNewUrlsLength() {
        return this.newUrls.size;
    }
}

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
        let _datas = [],
            _titleTarget,
            _indexTargetText,
            _imageTargetSrc;

        $('.board-wrapper dd').each((index, item) => {
            _titleTarget = $(item).find('.name a');
            _indexTargetText = $(item).find('.board-index').text();
            _imageTargetSrc = $(item).find('.board-img').attr('src') || $(item).find('.board-img').attr('data-src');
            //下载原图比较慢
            _imageTargetSrc = _imageTargetSrc.replace(/@.*$/g, '');
            //下载图片
            // this.downloadImage(_imageTargetSrc, path.join(__dirname, util.format('output/src/%s.jpg', _indexTargetText)));
            _datas.push({
                title: _titleTarget.text(),
                url: url.resolve(newUrl, _titleTarget.attr('href')),
                index: _indexTargetText,
                src: _imageTargetSrc
            });
        });
        return _datas;
    }

    /**
     * 下载单个图片
     * @param src {String}
     * @param fileName {String}
     */
    downloadImage(src, fileName) {
        //请求的图片通过管道流向打开的文件流完成图片下载
        request(src).on('error', (error) => {
            console.log(util.format('图片%s下载失败', src));
        }).pipe(fs.createWriteStream(fileName)).on('close', () => {
            console.log(util.format('图片%s下载完毕', src));
        });
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

        $('.list-pager').find('a').each((index, item) => {
            _url = $(item).attr('href');
            if (/\?offset=\d+$/.test(_url)) {
                _urls.push(url.resolve(newUrl, _url));
            }
        });
        return _urls;
    }
}

//输出数据
class Output {

    //构造函数
    constructor() {
        this.datas = [];
    }

    /**
     * 存储data数据
     * @param datas {Array}
     */
    storeDatas(datas) {
        datas.forEach((item, index) => {
            this.datas.push(item);
        });
    }

    /**
     * 下载所有图片，限制2个并发，解决IO处理并发瓶颈以及缓解请求服务器压力避免被屏蔽ip
     */
    downloadAllImage() {
        asyncOther.mapLimit(this.datas, 2, async (item) => {
            await this.downloadImage(item.src, path.join(__dirname, util.format('output/src/%s.jpg', item.index)));
            return '';
        }, (error, result) => {
            if (error) throw error;
            console.log('图片全部下载完毕！');
        });
    }

    /**
     * 下载单个图片，下一张图片暂停几秒
     * @param src {String}
     * @param fileName {String}
     */
    downloadImage(src, fileName) {
        /**
         * 暂停执行
         * @param second 暂停执行的秒数
         * @private
         */
        let _sleepFn = (second) => {
                var _start = +new Date();
                while (+new Date - _start < second * 1000) {
                }
            },
            _sleepSecond = 1;

        //请求的图片通过管道流向打开的文件流完成图片下载
        return new Promise((resolve, reject) => {
            try {
                request(src).on('error', (error) => {
                    console.log(util.format('图片%s下载失败', src));
                    _sleepFn(_sleepSecond);
                    reject();
                }).pipe(fs.createWriteStream(fileName)).on('close', () => {
                    console.log(util.format('图片%s下载完毕', src));
                    _sleepFn(_sleepSecond);
                    resolve();
                });
            } catch (error) {
                throw error;
            }
        });
    }

    /**
     * 导出数据到html
     */
    outputHTML() {

        //先对数据进行排序，然后生成格式化后的html
        let _html = this.datas.sort((x, y) => {
            return x.index - y.index;
        }).map((item) => {
            return util.format('%s.<img src="%s" style="height:30px;margin:0 10px 10px;vertical-align:middle;"/><a href="%s">%s</a><br/>', item.index, util.format('src/%s.jpg', item.index), item.url, item.title);
        });

        //对html添加额外的代码
        _html = util.format('<meta charset="utf-8"/>%s<br/>%s', new Date(), _html.join(''));
        //同步写入文件
        fs.writeFileSync(path.join(__dirname, 'output/output.html'), _html);
    }
}

//调度器
class Scheduler {

    //构造函数
    constructor() {
        this.urls = new Urls();
        this.download = new Download();
        this.parser = new Parser();
        this.output = new Output();
    }

    /**
     * 开始爬取
     * @param root_url {String}，爬取的入口url
     */
    crawler(root_url) {

        //添加到未爬取集合中
        this.urls.addNewUrl(root_url);

        //异步处理http。node7.6开始支持async
        //1.setTimeout,setInterval是规定时间插入队列空闲执行
        //2.async await返回上一个执行栈(当前执行环境)等待promise状态改变后，继续之前之前的执行栈代码
        //3.事件循环是执行栈[当前执行环境]中将异步代码添加到任务队列。(包括微任务队列：process.nextTick，Promise和async/await，MessageChannel；宏任务队列的六个阶段：setInterval和setTimeout，上轮没执行的IO，idle和prepare，本轮IO，setImmediate，close事件)主线程执行完同步代码后，将全部微任务回调[函数]放回执行栈执行完后，再将宏任务队列第一个任务回调[函数]放入执行栈执行并将执行栈内的全部微任务回调[函数]执行完后，再执行下一个宏任务回调[函数]，直到执行完宏任务所有阶段完成一次循环后，在进入下一个循环即上一个循环新加入的任务队列(node10和浏览器执行顺序不一致，node11和浏览器执行顺序一致了)
        (async () => {
            //遍历未爬取集合
            while (this.urls.getNewUrlsLength() > 0) {
                try {
                    //从未爬取集合取出一项url
                    let _url = this.urls.getNewUrl();
                    //下载一个url页
                    let _html = await this.download.download(_url);
                    //得到需要的数据datas，以及页面要继续爬取的urls
                    let {datas, urls} = this.parser.parserHTML(_url, _html);
                    //将urls加入未爬取集合
                    this.urls.addNewUrls(urls);
                    //将datas存储
                    this.output.storeDatas(datas);
                } catch (e) {
                    console.log(util.format('%s爬取失败', _url));
                }
            }
            //下载所有图片
            this.output.downloadAllImage();
            //输出html
            this.output.outputHTML();
        })();
    }
}

//实例化
crawler = new Scheduler();
crawler.crawler('https://maoyan.com/board/4?offset=0');