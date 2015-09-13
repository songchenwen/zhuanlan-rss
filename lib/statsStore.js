var Datastore = require('nedb');
var moment = require('moment');
var sortRss = require('./sortRss');

var trimItemTime = moment.duration(6, 'months');

var typeRequest = 'request';
var typeZhuanlan = 'zhuanlan';
var typeItem = 'item';

var Store = function(file, itemStore, log){
	this.db = new Datastore({ filename: file, autoload: true });
	this.itemStore = itemStore;
	this.log = log;
	this.db.ensureIndex({fieldName: 'zhuanlan'}, function(err){
		if(err){
			log.warn('index zhuanlan err ' + err);
		}
	});
	this.db.ensureIndex({fieldName: 'type'}, function(err){
		if(err){
			log.warn('index type err ' + err);
		}
	});
	this.db.ensureIndex({fieldName: 'date'}, function(err){
		if(err){
			log.warn('index date err ' + err);
		}
	});
	this.db.ensureIndex({fieldName: 'guid', sparse: true}, function(err){
		if(err){
			log.warn('index date err ' + err);
		}
	});
	this.trim();
}

Store.prototype.addRequest = function(request, ids) {
	if(!Array.isArray(ids)){
		ids = [ids];
	}
	var db = this.db;
	var log = this.log;
	var s = this;
	var now = new Date();
	var docs = [];
	docs.push({
		date: now,
		type: typeRequest,
		zhuanlan: ids,
		url: ids.join(','),
		ip: request.ip
	});
	ids.forEach(function(id){
		docs.push({
			date: now,
			type: typeZhuanlan,
			zhuanlan: id,
			url: ids.join(','),
			ip: request.ip
		});
	});
	db.insert(docs, function(err, newDocs){
		if(err){
			log.warn(err, 'stats insert request err');
		}
	});	
};

Store.prototype.addItem = function(guid, request){
	var db = this.db;
	var itemStore = this.itemStore;
	var log = this.log;
	var s = this;
	guid = parseInt(guid);
	itemStore.getByGuid(guid, function(err, doc){
		if(err){
			log.warn(err, 'stats insert item get err');
			return;
		}
		if(!doc){
			return;
		}
		var now = new Date();
		db.insert({
			date: now,
			type: typeItem,
			zhuanlan: doc.zhuanlan,
			url: doc.url,
			guid: guid,
			title: doc.title,
			ip: request.ip
		}, function(err, newDocs){
			if(err){
				log.warn(err, 'stats insert item err');
			}
		});
	});
};

Store.prototype.popularUrl = function(options, cb){
	options = parseOptions(options);
	var from = options.from;
	var to = options.to;
	var limit = options.limit;

	var db = this.db;
	var log = this.log;
	var s = this;
	db.find({type: typeRequest, date:{ $lte:to, $gt:from }}, function(err, docs){
		if(err){
			cb(err);
			return;
		}
		if(!docs || docs.length == 0){
			cb(null, []);
			return;
		}
		var urls = {};
		docs.forEach(function(doc){
			if(urls.hasOwnProperty(doc.url)){
				var u = urls[doc.url];
				if(doc.date > u.date){
					u.date = doc.date;
				}
				u.requests.push({ip: doc.ip, date: doc.date});
				u.count += 1;
			} else {
				urls[doc.url] = {
					url: doc.url,
					zhuanlan: doc.zhuanlan,
					date: doc.date,
					requests: [{ip: doc.ip, date: doc.date}],
					count: 1
				};
			}
		});
		var results = [];
		for(var u in urls){
			u = urls[u];
			sortRss(u.requests);
			results.push(u);
		}
		results.sort(popularSort);
		if(results.length > limit){
			results = results.slice(0, limit);
		}
		cb(null, results);
	});
};

Store.prototype.popularZhuanlan = function(options, cb){
	options = parseOptions(options);
	var from = options.from;
	var to = options.to;
	var limit = options.limit;
	
	var db = this.db;
	var log = this.log;
	var s = this;
	db.find({type: typeZhuanlan, date:{ $lte:to, $gt:from }}, function(err, docs){
		if(err){
			cb(err);
			return;
		}
		if(!docs || docs.length == 0){
			cb(null, []);
			return;
		}
		var zhuanlans = {};
		docs.forEach(function(doc){
			if(zhuanlans.hasOwnProperty(doc.zhuanlan)){
				var u = zhuanlans[doc.zhuanlan];
				if(doc.date > u.date){
					u.date = doc.date;
				}
				u.requests.push({url: doc.url, ip: doc.ip, date: doc.date});
				u.count += 1;
			} else {
				zhuanlans[doc.zhuanlan] = {
					zhuanlan: doc.zhuanlan,
					date: doc.date,
					requests: [{url: doc.url, ip: doc.ip, date: doc.date}],
					count: 1
				};
			}
		});
		var results = [];
		for(var u in zhuanlans){
			u = zhuanlans[u];
			sortRss(u.requests);
			results.push(u);
		}
		results.sort(popularSort);
		if(results.length > limit){
			results = results.slice(0, limit);
		}
		cb(null, results);
	});
};

Store.prototype.popularItem = function(options, cb){
	options = parseOptions(options);
	var from = options.from;
	var to = options.to;
	var limit = options.limit;
	
	var db = this.db;
	var log = this.log;
	var s = this;

	db.find({type: typeItem, date:{ $lte:to, $gt:from }}, function(err, docs){
		if(err){
			cb(err);
			return;
		}
		if(!docs || docs.length == 0){
			cb(null, []);
			return;
		}
		var items = {};
		docs.forEach(function(doc){
			if(items.hasOwnProperty(doc.guid)){
				var u = items[doc.guid];
				if(doc.date > u.date){
					u.date = doc.date;
				}
				u.requests.push({ ip: doc.ip, date: doc.date});
				u.count += 1;
			} else {
				items[doc.guid] = {
					zhuanlan: doc.zhuanlan,
					date: doc.date,
					guid: doc.guid,
					url: doc.url,
					title: doc.title,
					requests: [{ ip: doc.ip, date: doc.date }],
					count: 1
				};
			}
		});
		var results = [];
		for(var u in items){
			u = items[u];
			sortRss(u.requests);
			results.push(u);
		}
		results.sort(popularSort);
		if(results.length > limit){
			results = results.slice(0, limit);
		}
		cb(null, results);
	});
};

Store.prototype.ipCount = function(options, cb){
	options = parseOptions(options);
	var from = options.from;
	var to = options.to;
	var type = options.type;
	
	var db = this.db;
	var log = this.log;
	var s = this;

	db.find({type: type, date:{ $lte:to, $gt:from }}, function(err, docs){
		if(err){
			cb(err);
			return;
		}
		if(!docs || docs.length == 0){
			cb(null, 0);
			return;
		}
		var ips = [];
		docs.forEach(function(doc){
			if(ips.indexOf(doc.ip) < 0){
				ips.push(doc.ip);
			}
		});
		cb(null, ips.length);
	});
};

Store.prototype.requestCount = function(options, cb){
	options = parseOptions(options);
	var from = options.from;
	var to = options.to;
	var type = options.type;
	
	var db = this.db;
	var log = this.log;
	var s = this;

	db.count({type: type, date:{ $lte:to, $gt:from }}, cb);
};

var parseOptions = function(options){
	options = (options || {});
	var to = options.to || new Date();
	var from = options.from || moment(to).subtract(moment.duration(1, 'days')).toDate();
	var limit = options.limit || 20;
	var type = options.type;
	if(type != typeRequest && type != typeItem){
		type = typeRequest;
	}
	return {from: from, to: to, limit: limit, type: type};
}

var popularSort = function(a, b){
	return b.count - a.count;
}

Store.prototype.trim = function(){
	var log = this.log;
	var db = this.db;
	var time = moment().subtract(trimItemTime).toDate();
	db.remove({date: { $lt: time }}, {multi: true}, function(err, num){
		if(err){
			log.warn(err, 'trim err');
		} else if(num > 0){
			db.persistence.compactDatafile();
			log.info('trimed ' + num + ' stats');
		}
	});
};

exports = module.exports = Store;
