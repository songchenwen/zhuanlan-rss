var Datastore = require('nedb');
var moment = require('moment');

var maxItemCount = require('./rssOptions').maxItemCount;
var trimItemTime = moment.duration(6, 'months');

var Store = function(file, log){
	this.db = new Datastore({ filename: file, autoload: true });
	this.log = log;
	this.db.ensureIndex({fieldName: 'zhuanlan'}, function(err){
		if(err){
			log.warn('index zhuanlan err ' + err);
		}
	});
	this.db.ensureIndex({fieldName: 'url', unique: true}, function(err){
		if(err){
			log.warn('index url err ' + err);
		}
	});
	this.db.ensureIndex({fieldName: 'guid', unique: true}, function(err){
		if(err){
			log.warn('index guid err ' + err);
		}
	});
	this.trim();
}

Store.prototype.getByZhuanlan = function(zhuanlans, cb) {
	if(!Array.isArray(zhuanlans)){
		zhuanlans = [zhuanlans];
	}
	var db = this.db;
	var log = this.log;
	var s = this;
	db.find({zhuanlan: { $in: zhuanlans }}).
		sort({ date: -1 }).
		limit(maxItemCount).
		exec(cb);
};

Store.prototype.add = function(items, cb) {
	if(!Array.isArray(items)){
		items = [items];
	}
	var db = this.db;
	var log = this.log;
	var s = this;
	var guids = [];
	items.forEach(function(item){
		if(guids.indexOf(item.guid) < 0){
			guids.push(item.guid);
		}
	});
	db.find({guid: { $in: guids}}, function(err, docs){
		if(err){
			cb(err);
			return;
		}
		if(docs.length == 0){
			db.insert(items, cb);
			return;
		}
		var existIds = {};
		docs.forEach(function(doc){
			existIds[doc.guid] = doc;
		});
		var toInserts = [];
		items.forEach(function(item){
			if(!existIds.hasOwnProperty(item.guid)){
				toInserts.push(item);
			}
		});
		if(toInserts.length > 0){
			db.insert(toInserts, cb);
		} else {
			cb(null, []);
		}
	});
};

Store.prototype.trim = function(){
	var log = this.log;
	var db = this.db;
	var time = moment().subtract(trimItemTime).toDate();
	db.remove({date: { $lt: time }}, {multi: true}, function(err, num){
		if(err){
			log.warn('trim err ' + err);
		} else if(num > 0){
			db.persistence.compactDatafile();
			log.info('trimed ' + num + ' docs');
		}
	});
}

exports = module.exports = Store;
