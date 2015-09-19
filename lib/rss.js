var fs = require('fs'),
	async = require('async'),
	RSS = require('rss'),
	sortRss = require('./sortRss'),
	Api = require('./api');
var requestTimeout = 15000;

var ZRSS = function(ids, itemStore, zhuanlanStore, log){
	this.ids = ids;
	this.itemStore = itemStore;
	this.zhuanlanStore = zhuanlanStore;
	this.rssOptions = require('./rssOptions');
	this.rssOptions.feed_url = this.rssOptions.feed_url + this.ids.join(',');
	this.expireTime = this.rssOptions.ttl * 60 * 1000;
	this.log = log;
	this.items = [];
	this.guids = [];
}

ZRSS.prototype.getItems = function(callback){
	this.items = [];
	this.guids = [];
	var items = this.items;
	var guids = this.guids;
	var ids = this.ids;
	var zhuanlanStore = this.zhuanlanStore;
	var itemStore = this.itemStore;
	var log = this.log;
	var zrss = this;
	zhuanlanStore.shouldFetch(ids, function(err, obj){
		var tasks = [];
		log.info(obj, 'should fetch');
		if(obj.fetch.length > 0){
			tasks.push(function(callback){
				var updatedIds = [];
				var newItems = [];
				var dbRetrys = [];
				async.each(obj.fetch, function(id, cb){
					log.info('api begin ' + id);
					var api = new Api(id);
					api.get(function(err, is){
						if(err){
							log.warn('api error ' + id + ': ' + err);
							dbRetrys.push(id);
							cb();
							return;
						}
						log.info('api got ' + is.length + ' of ' + id);
						if(is.length > 0){
							updatedIds.push(id);
							is.forEach(function(i){
								if(guids.indexOf(i.guid) < 0){
									newItems.push(i);
								}
							});
						}
						cb();
					});
				}, function(err, results){
					if(newItems.length > 0){
						var inserts = [];
						newItems.forEach(function(item){
							if(guids.indexOf(item.guid) < 0){
								items.push(item);
								inserts.push(item)
								guids.push(item.guid);
							}
						});
						if(inserts.length > 0){
							itemStore.add(inserts, function(err, newItems){
								if(err){
									log.warn('item insert err ' + err);
								}else{
									log.info('item inserted ' + newItems.length + ' / ' + inserts.length);	
								}
							});
						}
					}
					if(updatedIds.length > 0){
						zhuanlanStore.update(updatedIds);
					}
					if(dbRetrys.length > 0){
						log.info('retry db for items ' + dbRetrys.join(','));
						zrss.getFromStore(dbRetrys, callback);
					} else {
						callback();	
					}
				});
			});
		}
		if(obj.cache.length > 0){
			tasks.push(function(callback){
				zrss.getFromStore(obj.cache, callback);
			});
		}
		async.parallel(tasks, callback);
	});
}

ZRSS.prototype.getFromStore = function(ids, cb){
	var items = this.items;
	var guids = this.guids;
	var itemStore = this.itemStore;
	var log = this.log;
	var zrss = this;
	itemStore.getByZhuanlan(ids, function(err, is){
		if(err){
			log.warn('item store get err ' + err);
			cb();
			return;
		}
		log.info('item store get ' + is.length + ' for ' + ids.join(','));
		if(is.length > 0){
			is.forEach(function(i){
				if(guids.indexOf(i.guid) < 0){
					items.push(i);
				}
			});
		}
		cb();
	});
}

ZRSS.prototype.saveToRss = function(cb){
	var items = this.items;
	var rssOptions = this.rssOptions;
	var log = this.log;
	if(items.length > 0){
		sortRss(items);
		var items = JSON.parse(JSON.stringify(items));
		var pubDate = items[0].date;
		rssOptions.pubDate = pubDate;
		log.info('rss pubDate ' + pubDate + ' for ' + this.ids.join(','));
		var feed = new RSS(rssOptions);
		var count = items.length;
		if(rssOptions.maxItemCount){
			count = Math.min(count, rssOptions.maxItemCount);
		}
		log.info('sending with ' + count + ' items for ' + this.ids.join(','));
		for(var i = 0; i < count; i++){
			var item = items[i];
			item.url = 'http://zhuanlan.zhihu.com' + item.url;
			item.description = item.description + trackImage(item.guid);
			feed.item(item);
		}
		cb(null, feed.xml());
	}else{
		cb('no items', null);
	}
}

var rssOptions = require('./rssOptions');
var trackImage = function(guid){
	var domain = 'localhost:5000';
	if(process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT){
		domain = rssOptions.domain;
	}
	return '<p><img src="http://' + domain + '/track/' + guid + '/spacer.gif" ></p>';
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
