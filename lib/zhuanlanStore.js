var Datastore = require('nedb');
var moment = require('moment');

var fetchInterval = moment.duration(4, 'hours');
var trimItemTime = moment.duration(6, 'months');

var Store = function(file, log){
	this.db = new Datastore({ filename: file, autoload: true });
	this.log = log;
	this.db.ensureIndex({fieldName: 'zhuanlan', unique: true}, function(err){
		if(err){
			log.warn('index zhuanlan err ' + err);
		}
	});
	this.trim();
	this.db.persistence.compactDatafile();
}

Store.prototype.shouldFetch = function(ids, cb){
	if(!Array.isArray(ids)){
		ids = [ids];
	}
	var db = this.db;
	var log = this.log;
	var s = this;
	var time = moment().subtract(fetchInterval).toDate();
	db.find({ zhuanlan: { $in: ids}, lastUpdate: { $gt: time} }, function(err, docs){
		if(err){
			log.warn('shouldFetch err ' + err);
			cb(null, {fetch: ids, cache:[]});	
			return;
		}
		if(docs && docs.length > 0){
			var existIds = {};
			docs.forEach(function(doc){
				existIds[doc.zhuanlan] = doc.lastUpdate;
			});
			var fetches = [];
			var caches = [];
			ids.forEach(function(id){
				if(existIds.hasOwnProperty(id)){
					caches.push(id);
				} else {
					fetches.push(id);
				}
			});
			cb(null, {fetch: fetches, cache: caches});
		} else {
			cb(null, {fetch: ids, cache: []});
		}
	});
}

Store.prototype.update = function(ids){
	if(!Array.isArray(ids)){
		ids = [ids];
	}
	var db = this.db;
	var log = this.log;
	var s = this;
	db.find({ zhuanlan: { $in: ids} }, function(err, docs){
		if(err){
			log.warn('update find err ' + err);
			return;
		}
		var existIds = {};
		docs.forEach(function(doc){
			existIds[doc.zhuanlan] = doc.lastUpdate;
		});
		var updates = [];
		var inserts = [];
		ids.forEach(function(id){
			if(existIds.hasOwnProperty(id)){
				updates.push(id);
			} else {
				inserts.push(id);
			}
		});
		var now = new Date();
		if(updates.length > 0){
			db.update({zhuanlan: { $in: updates }}, 
				{$set:{lastUpdate: now}}, 
				{ multi: true }, 
				function(err, numReplaced){
					if(err){
						log.warn('update err ' + err);
					} else if(numReplaced <= 0){
						log.warn('update not find ' + updates.join(','));
					} else {
						log.info('update zhuanlan ' + numReplaced);
					}
				});
		}
		if(inserts.length > 0){
			var inDocs = [];
			inserts.forEach(function(id){
				inDocs.push({
					zhuanlan: id,
					lastUpdate: now
				});
			});
			db.insert(inDocs, function(err, newDocs){
				if(err){
					log.warn('insert zhuanlan err ' + err);
				} else if(newDocs.length <= 0) {
					log.warn('insert zhuanlan 0 ' + inserts.join(','));
				} else {
					log.info('insert zhuanlan ' + newDocs.length);
				}
			});
		}
	});
}

Store.prototype.trim = function(){
	var log = this.log;
	var db = this.db;
	var time = moment().subtract(trimItemTime).toDate();
	db.remove({lastUpdate: { $lt: time }}, {multi: true}, function(err, num){
		if(err){
			log.warn('trim zhuanlan err ' + err);
		} else if(num > 0){
			log.info('trimed ' + num + ' zhuanlans');
		}
	});
}

exports = module.exports = Store;
