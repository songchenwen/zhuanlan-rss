var fs = require('fs'),
	request = require('request'),
	async = require('async'),
	RSS = require('rss'),
	rssOptions = require('./rssOptions'),
	sortRss = require('./sortRss');

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
		for(var i = 0; i < results.length; i++){
			var list = results[i];
			if(!list || list.length == 0){
				zhihuIds.push(ids[i]);
				continue;
			}
			console.log('got ' + list.length + ' items of ' + ids[i] + ' from storage');
			list.forEach(function(i){
				items.push(i);
			});
		}
		if(zhihuIds.length > 0){
			fetchFromZhihu(zhihuIds, callback);
		}else{
			callback();
		}
	});
}

var fetchFromZhihu = function(ids, callback){
	async.each(ids, function(id, cb){
		request('http://zhuanlan.zhihu.com/api/columns/' + id + '/posts', function(error, response, body){
			if(error){
				console.log('got error ' + error + ' from ' + id + ' from zhihu');
				cb();
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
			}catch(e){
				console.log('got error ' + e + ' from ' + id + ' from zhihu parse');
			}
			cb();
		});
	}, callback);
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