var fs = require('fs'),
	request = require('request'),
	async = require('async'),
	RSS = require('rss'),
	rssOptions = require('./rssOptions');

var items = [];

var getItems = function(ids, callback){
	async.each(ids, function(id, cb){
		request('http://zhuanlan.zhihu.com/api/columns/' + id + '/posts', function(error, response, body){
			if(error){
				cb(error);
				return;
			}
			try{
				body = JSON.parse(body);
				body.forEach(function(item){
					items.push(item);
				});
			}catch(e){
				console.log('got error ' + e + ' from ' + id);
			}
			cb();
		});
	}, function(error){
		if(!error){
			console.log("success got " + items.length + " items");
		}else{
			console.log("error : " + error);
		}
		if(callback){
			callback(error);
		}
	});
}

var sortItems = function(){
	items.sort(function(a, b){
		return new Date(b.publishedTime) - new Date(a.publishedTime);
	});
};

var saveToRss = function(path, cb){
	if(items.length > 0){
		var pubDate = items[0].publishedTime;
		rssOptions.pubDate = pubDate;
		console.log('pubDate ' + pubDate);
		var feed = new RSS(rssOptions);
		var count = items.length;
		if(rssOptions.maxItemCount){
			count = Math.min(count, rssOptions.maxItemCount);
		}
		console.log('saving with ' + count + ' items');
		for(var i = 0; i < count; i++){
			feed.item(feedItemFromJson(items[i]));
		}
		fs.writeFile(path, feed.xml(), function (err) {
  			if (err){
  				if(cb){
  					cb(err);
  				}
  				return;
  			}
  			var logStr = 'newest post ' + pubDate +'\n';
  			if(cb){
  				cb();
  			}
		});
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

module.exports = function(ids, path, cb){
	getItems(ids, function(error){
		if(!error){
			sortItems();
			saveToRss(path, cb);
		}else{
			cb(error);
		}
	});
}