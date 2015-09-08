
var express = require('express');
var storage = require('./lib/storage');
var app = express();

app.set('port', (process.env.PORT || 5000));

var xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

app.get('/rss/:ids', function(request, response) {
	var beginTime = new Date().getTime();
	var ids = request.params.ids.split(',');
	var rss = require('./lib/rss');
	rss.storage = storage;
	console.log('request ids ' + ids.join(','));

	var headerSent = false;

	var keepAliveTimer = setInterval(function(){
		if(!headerSent){
			console.log('send header first');
			response.set('Content-Type', 'text/xml');
			response.status('200').write(xmlHeader + '\n');
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
			if(headerSent){
				xml = xml.replace(xmlHeader, '');
			}
			response.write(xml);
		}
		response.end();
		console.log('response time ' + ((new Date().getTime() - beginTime) / 1000) + 's');
	});
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
