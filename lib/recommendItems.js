
var moment = require('moment');
var memCache = require('memory-cache');


var memCacheTime = 4 * 60 * 60 * 1000;
var memCacheKey = 'recommend_items';

var typeItem = 'item';
var limit = 20;

var Rec = function(statsStore, itemStore, log){
	this.statsStore = statsStore;
	this.itemStore = itemStore;
	this.log = log;
}

Rec.prototype.get = function(callback) {
	var cached = memCache.get(memCacheKey);
	if(cached){
		callback(null, cached);
		return;
	}
	var statsStore = this.statsStore;
	var log = this.log;
	var itemStore = this.itemStore;
	var s = this;

	var to = new Date();
	var from = moment(to).subtract(moment.duration(5, 'days')).toDate();

	statsStore.popularItem({ from: from, to: to, limit:100000 }, function(err, docs){
		if(err){
			callback(err);
			return;
		}
		if(docs.length == 0){
			callback(null, docs);
			return;
		}
		var guids = [];
		docs.forEach(function(doc){
			guids.push(doc.guid);
		});
		itemStore.getByGuid(guids, function(err, items){
			if(err){
				callback(err);
				return;
			}
			if(items.length == 0){
				callback(null, []);
				return;
			}
			var results = [];
			for(var i = 0; i < docs.length; i++){
				if(items[i]){
					docs[i].date = new Date(items[i].date.toString());
					docs[i].rate = rating(docs[i], from, to);
					results.push(docs[i]);
				}
			}
			results.sort(sortResults);
			if(results.length > limit){
				results = results.slice(0, limit);
			}
			memCache.put(memCacheKey, results, memCacheTime);
			callback(null, results);
		});
	});
};

function log10(val) {
  return Math.log(val) / Math.LN10;
}

var sortResults = function(a, b){
	return b.rate - a.rate;
}

var rating = function(item, from, to){
	var Z = item.ips.length * (item.ips.length <= 1 ? 0 : 2) + item.count * (item.requests[0].date.getTime() - from.getTime()) / (to.getTime() - from.getTime()) * 0.5;
	var ts = item.date.getTime() - new Date(from.getTime() - 5 * 24 * 60 * 60 * 1000);
	return Math.log(Z) + ts/(100000 * 1000) 
}

exports = module.exports = Rec;