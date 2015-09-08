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
	var currentTime = new Date().getTime();
	var accessHash = {};
	ids.forEach(function(i){
		accessHash[accessPrefix + i] = currentTime;
	});
	redis.pipeline().mget(query).
		mset(accessHash).
		exec(function(error, results){
			var err = results[0][0];
			var result = results[0][1];
			if(results[1][0]){
				console.log('set access hash error ' + results[1][0]);
			}
			if(results[1][1]){
				console.log('set access hash result ' + results[1][1]);
			}
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
			}
			cb(null, results);
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

process.on('exit', function(code) {
	console.log('exit');
	redis.disconnect();
});

module.exports = {
	save: save,
	get: get
};