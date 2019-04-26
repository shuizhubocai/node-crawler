/*
Navicat MySQL Data Transfer

Source Server         : site
Source Server Version : 50090
Source Host           : localhost:3306
Source Database       : crawler

Target Server Type    : MYSQL
Target Server Version : 50090
File Encoding         : 65001

Date: 2019-04-26 18:09:27
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for crawler_urls
-- ----------------------------
DROP TABLE IF EXISTS `crawler_urls`;
CREATE TABLE `crawler_urls` (
  `id` int(20) NOT NULL auto_increment,
  `movie_url` varchar(100) default NULL COMMENT '电影url',
  `status` tinyint(10) default NULL COMMENT '爬取状态，1已经爬取，0未爬取',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ----------------------------
-- Table structure for movie
-- ----------------------------
DROP TABLE IF EXISTS `movie`;
CREATE TABLE `movie` (
  `id` int(11) NOT NULL auto_increment,
  `movie_title` varchar(100) default NULL COMMENT '电影标题',
  `movie_type` varchar(20) default NULL COMMENT '电影类型',
  `movie_show_date` varchar(20) default NULL COMMENT '电影上市时间',
  `movie_introduction` varchar(200) default NULL COMMENT '电影简介',
  `movie_duration` varchar(20) default NULL COMMENT '电影时长',
  `movie_location` varchar(20) default NULL COMMENT '电影上映的地方',
  PRIMARY KEY  (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
