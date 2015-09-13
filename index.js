
var express = require('express');
var compression = require('compression');
var bodyParser = require('body-parser');
var forceDomain = require('forcedomain');
var moment = require('moment');
var async = require('async');
var memCache = require('memory-cache');
var bunyan = require('bunyan');
var bunyanFormat = require('bunyan-format')({ outputMode: 'short' });
var rssOptions = require('./lib/rssOptions');
var Rss = require('./lib/rss');
var ItemStore = require('./lib/itemStore');
var ZhuanlanStore = require('./lib/zhuanlanStore');
var StatsStore = require('./lib/statsStore');

var log = bunyan.createLogger({name: 'zr', stream: bunyanFormat});

var dbDir = (process.env.OPENSHIFT_DATA_DIR || (__dirname + '/data'));
var itemStore = new ItemStore(dbDir + '/item', log.child({store:'item'}));
var zhuanlanStore = new ZhuanlanStore(dbDir + '/zhuanlan', log.child({store:'zhuanlan'}));
var statsStore = new StatsStore(dbDir + '/stats', itemStore, log.child({store:'stats'}));

var memCacheTime = rssOptions.ttl * 60 * 1000;

var startTime = new Date().getTime();

var app = express();

app.set('port', (process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 5000));
app.set('ip', process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.set('view engine', 'jade');
if(process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT){
	app.use(forceDomain({ hostname: rssOptions.domain }));	
}
app.use(compression());
app.use(express.static('public', { maxAge: '1d' }));

var xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

app.post('/', function(request, response){
	if(request.body.ids){
		var ids = request.body.ids.trim();
		var ids = ids.split(',');
		var query = '';
		ids.forEach(function(id){
			query = query + id.trim() + ',';
		});
		query = query.substring(0, query.length - 1);
		log.info('posted ' + query);
		response.redirect('/rss/' + query);
	}
	response.status(404).end();
});

app.get('/rss/:ids', function(request, response) {
	if(!request.params.ids){
		response.redirect('/');
		return;
	}
	var beginTime = new Date().getTime();
	var ids = [];
	request.params.ids.split(',').forEach(function(id){
		id = id.trim();
		if(id){
			ids.push(id);
		}
	});
	if(ids.length == 0){
		response.redirect('/');
		return;
	}
	statsStore.addRequest(request, ids);
	var cached = memCache.get(ids.join(','));
	if(cached){
		log.info('found mem cache for ' + ids.join(','));
		response.set('Content-Type', 'text/xml');
		response.send(cached).end();
		return;
	}
	var rss = new Rss(ids, itemStore, zhuanlanStore, log.child({ rss: 'rss' }));
	log.info('request ids ' + ids.join(','));

	var headerSent = false;

	var keepAliveTimer = setInterval(function(){
		if(!headerSent){
			log.info('send header first');
			response.set('Content-Type', 'text/xml');
			response.status('200').write(xmlHeader + '\n');
			headerSent = true;
			return;
		}
		log.info('keep alive heart beat');
		response.write(' ');
	}, 10000);

	rss.get(function(err, xml){
		clearInterval(keepAliveTimer);
		if(err){
			response.write(err);
		}else{
			memCache.put(ids.join(','), xml, memCacheTime);
			if(headerSent){
				xml = xml.replace(xmlHeader, '');
			}
			response.write(xml);
		}
		response.end();
		log.info('response time ' + ((new Date().getTime() - beginTime) / 1000) + 's');
	});
});

app.get('/stats', function(request, response){
	var feed = {};
	var urls;
	var zhuanlans;
	async.parallel([
		function(cb){
			statsStore.ipCount({type:'request'}, cb);
		}, 
		function(cb){
			statsStore.requestCount({type:'request'}, cb);
		},
		function(cb){
			statsStore.popularUrl({}, cb);
		},
		function(cb){
			statsStore.popularZhuanlan({}, cb);
		},
	], function(err, results){
		response.render('stats', {
			err: err,
			startTime: startTime,
			host: process.env.OPENSHIFT_NODEJS_PORT ? 'OpenShift' : (process.env.PORT ? 'Heroku' : 'Local'),
			memCacheKeys: memCache.keys(),
			feed: {
				ipCount: results[0],
				requestCount: results[1]
			},
			urls: results[2],
			zhuanlans: results[3],
			moment: moment
		});
	});
});

app.listen(app.get('port'), app.get('ip'), function() {
  log.info('Node app is running on port', app.get('port'));
});
