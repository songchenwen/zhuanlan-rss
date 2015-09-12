
var express = require('express');
var compression = require('compression');
var bodyParser = require('body-parser');
var forceDomain = require('forcedomain');
var moment = require('moment');
var cache = require('memory-cache');
var rssOptions = require('./lib/rssOptions');
var storage = require('./lib/storage');

var cacheTime = 1 * 60 * 60 * 1000;
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
		console.log('posted ' + query);
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
	var cached = cache.get(ids.join(','));
	if(cached){
		console.log('found mem cache for ' + ids.join(','));
		response.set('Content-Type', 'text/xml');
		response.status('200').write(cached);
		response.end();
		return;
	}
	var rss = require('./lib/rss');
	rss.storage = storage;
	console.log('request ids ' + ids.join(','));

	var headerSent = false;

	var keepAliveTimer = setInterval(function(){
		if(!headerSent){
			console.log('send header first');
			response.set('Content-Type', 'text/xml');
			response.status('200').write(xmlHeader + '\n');
			headerSent = true;
			return;
		}
		console.log('keep alive heart beat');
		response.write(' ');
	}, 10000);

	rss.get(ids, function(err, xml){
		clearInterval(keepAliveTimer);
		if(err){
			response.write(err);
		}else{
			cache.put(ids.join(','), xml, cacheTime);
			if(headerSent){
				xml = xml.replace(xmlHeader, '');
			}
			response.write(xml);
		}
		response.end();
		console.log('response time ' + ((new Date().getTime() - beginTime) / 1000) + 's');
	});
});

app.get('/stats', function(request, response){
	storage.stats(function(err, result){
		response.render('stats', {
			startTime: startTime,
			host: process.env.OPENSHIFT_NODEJS_PORT ? 'OpenShift' : (process.env.PORT ? 'Heroku' : 'Local'),
			memCacheKeys: cache.keys(),
			access: result,
			err: err,
			moment: moment
		});
	});
});

app.listen(app.get('port'), app.get('ip'), function() {
  console.log('Node app is running on port', app.get('port'));
});
