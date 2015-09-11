var Redis = require('ioredis');
var Url = require('url');
var sortRss = require('./sortRss');

redisUrl = process.env.REDIS_URL ? process.env.REDIS_URL : 'redis://localhost:6379';

var redis = new Redis(redisUrl);
var expireTime = 120 * 60 * 1000;

var itemPrefix = 'zhuanlan-rss:item:';
var accessPrefix = 'zhuanlan-rss:last_access:';
var trimAccessTime = 3 * 24 * 60 * 60 * 1000;

var save = function(id, items){
	sortRss(items);
	var obj = {
		time: new Date().getTime(),
		items: items
	};
	redis.pipeline().set(itemPrefix + id, JSON.stringify(obj)).
		set(accessPrefix + id, obj.time).
		exec();
}

var get = function(ids, cb){
	if(!ids || ids.length == 0){
		cb(null, null);
		return;
	}
	var query = [];
	for(var i = 0; i < ids.length; i++){
		query.push(itemPrefix + ids[i]);
	}
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
			objs.forEach(function(i){
				i = JSON.parse(i);
				if(!i){
					results.push(null);
					return;
				}
				if(!i.hasOwnProperty('time') || !i.hasOwnProperty('items')){
					results.push(null);
					return;
				}
				if(currentTime - i.time > expireTime){
					results.push(null)
					return;
				}
				var list = i.items;
				if(list.length > 0){
					results.push(list);
				}else{
					results.push(null);
				}
			});
			if(results.length == 0){
				cb(null, null);
				return;
			}
			cb(null, results);
			var accessHash = {};
			var accessCount = 0;
			for(var i = 0; i < results.length; i++){
				var item = results[i];
				if(item && item.length > 0){
					accessHash[accessPrefix + ids[i]] = currentTime;
					accessCount++;
				}
			}
			if(accessCount > 0){
				redis.mset(accessHash, function(err, result){
					if(err){
						console.log('set access time err ' + err);
					}else{
						console.log('set access time ok');
					}
				});
			}
		});
}

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
				console.log('deleting ' + id + ' for inactivity');
				dels.push(id);
				dels.push(id.replace(itemPrefix, accessPrefix));
			}
		}
		if(dels.length > 0){
			redis.del(dels);
		}
	});
});

var stats = function(cb){
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

process.on('exit', function(code) {
	console.log('exit');
	redis.disconnect();
});

module.exports = {
	save: save,
	get: get,
	stats: stats
};