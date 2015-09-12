var Redis = require('ioredis');
var Url = require('url');
var sortRss = require('./sortRss');

var itemPrefix = 'zhuanlan-rss:item:';
var accessPrefix = 'zhuanlan-rss:last_access:';
var trimAccessTime = 3 * 24 * 60 * 60 * 1000;

var Storage = function(url, log){
	this.log = log;
	this.log.info('connecting to ' + url);
	this.redis = new Redis(url);
	this.redis.on('error', function(err){
		log.warn('connect err ' + err);
	});
	this.redis.on('ready', function(){
		log.info('connected successfully');
	});
	var s = this;
	process.on('exit', function(code) {
		s.redis.disconnect();
	});
}

Storage.prototype.save = function(id, items){
	sortRss(items);
	var obj = {
		time: new Date().getTime(),
		items: items
	};
	this.redis.pipeline().set(itemPrefix + id, JSON.stringify(obj)).
		set(accessPrefix + id, obj.time).
		exec();
}

Storage.prototype.get = function(ids, cb){
	if(!ids || ids.length == 0){
		cb(null, null);
		return;
	}
	var query = [];
	for(var i = 0; i < ids.length; i++){
		query.push(itemPrefix + ids[i]);
	}
	var redis = this.redis;
	var log = this.log;
	redis.mget(query, function(err, result){
			if(err){
				cb(err);
				return;
			}
			if(!result){
				cb(null, null);
				return;
			}
			var objs = result;
			if(!objs || objs.length == 0){
				cb(null, null);
				return;
			}
			var results = [];
			var currentTime = new Date().getTime();
			var accessMap = {};
			var accessCount = 0;
			for(var i = 0; i < objs.length; i++){
				var obj = JSON.parse(objs[i]);
				if(!obj){
					results.push(null);
					continue;
				}
				if(!obj.hasOwnProperty('time') || !obj.hasOwnProperty('items')){
					results.push(null);
					continue;
				}
				if(obj.items.length > 0){
					results.push(obj);
					accessMap[accessPrefix + ids[i]] = currentTime;
					accessCount++;
				}else{
					results.push(null);
				}
			}
			if(accessCount == 0){
				cb(null, null);
				return;
			}
			cb(null, results);
			redis.mset(accessMap, function(err, result){
				if(err){
					log.warn('set access time err ' + err);
				}else{
					log.info('set access time ok');
				}
			});
		});
}

Storage.prototype.trim = function(){
	var redis = this.redis;
	var log = this.log;
	redis.keys(itemPrefix + '*', function(err, ids){
		var currentTime = new Date().getTime();
		var query = [];
		ids.forEach(function(item){
			query.push(item.replace(itemPrefix, accessPrefix));
		});
		redis.mget(query, function(err, times){
			if(!times || times.length == 0){
				return;
			}
			var dels = [];
			for(var i = 0; i < ids.length; i++){
				var id = ids[i];
				var time = times[i];
				if(time && currentTime - time > trimAccessTime){
					log.info('deleting ' + id + ' for inactivity');
					dels.push(id);
					dels.push(id.replace(itemPrefix, accessPrefix));
				}
			}
			if(dels.length > 0){
				redis.del(dels);
			}
		});
	});
}

Storage.prototype.stats = function(cb){
	var redis = this.redis;
	redis.keys(accessPrefix + '*', function(err, ids){
		if(err){
			cb(err);
			return;
		}
		if(!ids || ids.length == 0){
			cb('empty');
			return;
		}
		redis.mget(ids, function(err, times){
			if(err){
				cb(err);
				return;
			}
			if(!times || times.length == 0){
				cb('empty');
				return;
			}
			var results = [];
			for(var i = 0; i < times.length; i++){
				var time = times[i];
				if(time){
					results.push({
						time: time,
						id: ids[i].replace(accessPrefix, '')
					});
				}
			}
			results.sort(function(a, b){
				return b.time - a.time;
			});
			cb(null, results);
		});
	});
}

exports = module.exports = Storage;