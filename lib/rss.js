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
	async.each(ids, function(id, cb){
		storage.get(id, function(err, is){
			if(err){
				console.log('storage error with ' + id + ': ' + err);
			}
			if(is && is.length > 0){
				console.log('got ' + is.length + ' items of ' + id + ' from storage');
				is.forEach(function(item){
					items.push(item);
				});
				cb();
			} else {
				fetchFromZhihu(id, function(error, is){
					if(error){
						console.log('zhihu error with ' + id + ': ' + err);
					}
					if(is && is.length > 0){
						console.log('got ' + is.length + ' items of ' + id + ' from zhihu');
						storage.save(id, is);
						is.forEach(function(item){
							items.push(item);
						});
					}
					cb();
				});
			}
		});
	}, function(error){
		if(!error){
			console.log("success got " + items.length + " items");
		}else{
			console.log("error : " + error);
		}
		if(callback){
			callback();
		}
	});
}

var fetchFromZhihu = function(id, cb){
	request('http://zhuanlan.zhihu.com/api/columns/' + id + '/posts', function(error, response, body){
			if(error){
				console.log('got error ' + error + ' from ' + id);
				cb(error);
				return;
			}
			try{
				body = JSON.parse(body);
				var is = [];
				body.forEach(function(item){
					is.push(feedItemFromJson(item));
				});
				cb(null, is);
			}catch(e){
				console.log('got error ' + e + ' from ' + id);
				cb(e);
			}
		});
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