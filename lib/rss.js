var fs = require('fs'),
	request = require('request'),
	async = require('async'),
	RSS = require('rss'),
	sortRss = require('./sortRss');

var ZRSS = function(ids, storage, log){
	this.ids = ids;
	this.storage = storage;
	this.rssOptions = require('./rssOptions');
	this.rssOptions.feed_url = this.rssOptions.feed_url + this.ids.join(',');
	this.expireTime = this.rssOptions.ttl * 60 * 1000;
	this.log = log;
	this.items = [];
}

ZRSS.prototype.getItems = function(callback){
	this.items = [];
	var items = this.items;
	var ids = this.ids;
	var storage = this.storage;
	var log = this.log;
	var zrss = this;
	storage.get(ids, function(err, results){
		if(err){
			log.info('storage error ' + err);
			zrss.fetchFromZhihu(ids, null, callback);
			return;
		}
		if(!results || results.length == 0){
			zrss.fetchFromZhihu(ids, null, callback);
			return;
		}
		var zhihuIds = [];
		var cacheItems = {};
		var currentTime = new Date().getTime();
		for(var i = 0; i < results.length; i++){
			var item = results[i];
			if(!item){
				zhihuIds.push(ids[i]);
				continue;
			}
			if(currentTime - item.time > zrss.expireTime){
				zhihuIds.push(ids[i]);
				cacheItems[ids[i]] = item.items;
				log.info('cache expired for ' + ids[i]);
				continue;
			}
			var list = item.items;
			log.info('got ' + list.length + ' items of ' + ids[i] + ' from storage');
			list.forEach(function(i){
				items.push(i);
			});
		}
		if(zhihuIds.length > 0){
			zrss.fetchFromZhihu(zhihuIds, cacheItems, callback);
		}else{
			callback();
		}
	});
}

ZRSS.prototype.fetchFromZhihu = function(ids, cacheItems, callback){
	var log = this.log;
	var items = this.items;
	var storage = this.storage;
	var zrss = this;
	async.each(ids, function(id, cb){
		log.info('fetch ' + id + ' from zhihu');
		request('http://zhuanlan.zhihu.com/api/columns/' + id + '/posts', function(error, response, body){
			if(error){
				log.warn('got error ' + error + ' from ' + id + ' from zhihu');
				zrss.retryWithCache(id, cacheItems, cb);
				return;
			}
			try{
				body = JSON.parse(body);
				var is = [];
				body.forEach(function(item){
					var i = feedItemFromJson(item)
					is.push(i);
					items.push(i);
				});
				log.info('got ' + is.length + ' items of ' + id + ' from zhihu');
				storage.save(id, is);
				cb();
			}catch(e){
				log.warn('got error ' + e + ' of ' + id + ' from zhihu parse');
				zrss.retryWithCache(id, cacheItems, cb);
			}
		});
	}, callback);
}

ZRSS.prototype.retryWithCache = function(id, cacheItems, cb){
	if(!cacheItems){
		cb();
		return;
	}
	var list = cacheItems[id];
	var items = this.items;
	var log = this.log;
	if(list && list.length > 0){
		log.info('got ' + list.length + ' items of ' + id + ' from outdated cache');
		list.forEach(function(i){
			items.push(i);
		});
	}
	cb();
}

ZRSS.prototype.saveToRss = function(cb){
	var items = this.items;
	var rssOptions = this.rssOptions;
	var log = this.log;
	if(items.length > 0){
		sortRss(items);
		var pubDate = items[0].date;
		rssOptions.pubDate = pubDate;
		log.info('pubDate ' + pubDate);
		var feed = new RSS(rssOptions);
		var count = items.length;
		if(rssOptions.maxItemCount){
			count = Math.min(count, rssOptions.maxItemCount);
		}
		log.info('sending with ' + count + ' items');
		for(var i = 0; i < count; i++){
			feed.item(items[i]);
		}
		cb(null, feed.xml());
	}else{
		cb('no items', null);
	}
}

var feedItemFromJson = function(json){
	var item = {
		title: json.title,
		description: json.content,
		url: 'http://zhuanlan.zhihu.com' + json.url,
		guid: json.slug,
		author: json.author.name + (json.author.bio ? ' | ' + json.author.bio : ''),
		date: json.publishedTime
	};
	return item;
}

ZRSS.prototype.get = function(cb){
	var zrss = this;
	this.getItems(function(error){
		if(!error){
			zrss.saveToRss(cb);
		}else{
			cb(error);
		}
	});
};

exports = module.exports = ZRSS;
