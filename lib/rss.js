var fs = require('fs'),
	request = require('request'),
	async = require('async'),
	RSS = require('rss'),
	rssOptions = require('./rssOptions'),
	sortRss = require('./sortRss');

var expireTime = 120 * 60 * 1000;

var ex = {};
var storage;
var items = [];

var getItems = function(ids, callback){
	items = [];
	storage.get(ids, function(err, results){
		if(err){
			console.log('storage error ' + err);
			fetchFromZhihu(ids, callback);
			return;
		}
		if(!results || results.length == 0){
			fetchFromZhihu(ids, callback);
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
			if(currentTime - item.time > expireTime){
				zhihuIds.push(ids[i]);
				cacheItems[ids[i]] = item.items;
				console.log('cache expired for ' + ids[i]);
				continue;
			}
			var list = item.items;
			console.log('got ' + list.length + ' items of ' + ids[i] + ' from storage');
			list.forEach(function(i){
				items.push(i);
			});
		}
		if(zhihuIds.length > 0){
			fetchFromZhihu(zhihuIds, cacheItems, callback);
		}else{
			callback();
		}
	});
}

var fetchFromZhihu = function(ids, cacheItems, callback){
	async.each(ids, function(id, cb){
		console.log('fetch ' + id + ' from zhihu');
		request('http://zhuanlan.zhihu.com/api/columns/' + id + '/posts', function(error, response, body){
			if(error){
				console.log('got error ' + error + ' from ' + id + ' from zhihu');
				retryWithCache(id, cacheItems, cb);
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
				console.log('got ' + is.length + ' items of ' + id + ' from zhihu');
				storage.save(id, is);
				cb();
			}catch(e){
				console.log('got error ' + e + ' from ' + id + ' from zhihu parse');
				retryWithCache(id, cacheItems, cb);
			}
		});
	}, callback);
}

var retryWithCache = function(id, cacheItems, cb){
	var list = cacheItems[id];
	if(list && list.length > 0){
		console.log('got ' + list.length + ' items of ' + id + ' from outdated cache');
		list.forEach(function(i){
			items.push(i);
		});
	}
	cb();
}

var saveToRss = function(ids, cb){
	if(items.length > 0){
		sortRss(items);
		var pubDate = items[0].date;
		rssOptions.pubDate = pubDate;
		console.log('pubDate ' + pubDate);
		rssOptions.feed_url = rssOptions.feed_url + ids.join(',');
		var feed = new RSS(rssOptions);
		var count = items.length;
		if(rssOptions.maxItemCount){
			count = Math.min(count, rssOptions.maxItemCount);
		}
		console.log('sending with ' + count + ' items');
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

ex.get = function(ids, cb){
	storage = ex.storage;
	getItems(ids, function(error){
		if(!error){
			saveToRss(ids, cb);
		}else{
			cb(error);
		}
	});
};

module.exports = ex;