var Redis = require('ioredis');
var Url = require('url');
var sortRss = require('./sortRss');

redisUrl = process.env.REDIS_URL ? process.env.REDIS_URL : 'redis://localhost:6379';

var redis = new Redis(redisUrl);
var expireTime = 120 * 60 * 1000;

var itemPrefix = 'zhuanlan-rss:item:';
var accessPrefix = 'zhuanlan-rss:last_access:';
var trimAccessTime = 15 * 24 * 60 * 60 * 1000;

var save = function(id, items){
	sortRss(items);
	var obj = {
		time: new Date().getTime(),
		items: items
	};
	redis.set(itemPrefix + id, JSON.stringify(obj));
	redis.set(accessPrefix + id, obj.time);
}

var get = function(id, cb){
	var currentTime = new Date().getTime();
	redis.get(itemPrefix + id, function(err, result){
		if(err){
			cb(err);
			return;
		}
		if(!result){
			cb(null, null);
			return;
		}
		var obj = JSON.parse(result.toString());
		if(!obj){
			cb(null, null);
			return;
		}
		if(!obj.hasOwnProperty('time') || !obj.hasOwnProperty('items')){
			cb(null, null);
			return;
		}
		if(currentTime - obj.time > expireTime){
			cb(null, null);
		} else {
			var list = obj.items;
			if(list.length > 0){
				cb(null, list);
			}else{
				cb(null, null);
			}
		}
	});
	redis.set(accessPrefix + id, currentTime);
}

redis.keys(itemPrefix + '*', function(err, result){
	var currentTime = new Date().getTime();
	result.forEach(function(item){
		var access = item.replace(itemPrefix, accessPrefix);
		redis.get(access, function(err, time){
			if(time && currentTime - time > trimAccessTime){
				console.log('deleting ' + item + ' for inactivity');
				redis.del(item);
				redis.del(access);
			}
		});
	});
});

process.on('exit', function(code) {
	console.log('exit');
	redis.disconnect();
});

module.exports = {
	save: save,
	get: get
};