
var express = require('express');
var storage = require('./lib/storage');
var app = express();

app.set('port', (process.env.PORT || 5000));

var xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

app.get('/', function(request, response) {
	var ids = 'yeka52,maboyong,datouma,gaizhilizcw,tianhao,qinnan,lianghuan,talich,loveletter,zenithdie,Glasschurch,nosensedigit,oldplusnew,negative2,taosay,DKLearnsPop,mactalk,lswlsw,rosicky311,zhimovie,liangbianyao,bianzhongqingnianxingdongzhinan,phos-study,wontfallinyourlap,24frames,wuliang8910'.split(',');
	var rss = require('./lib/rss');
	rss.storage = storage;
	console.log('request ids ' + ids.join(','));
	response.set('Content-Type', 'text/xml');
	response.status('200').write(xmlHeader + '\n');

	var keepAliveTimer = setInterval(function(){
		console.log('keep alive heart beat');
		response.write(' \n');
	}, 10000);

	rss.get(ids, function(err, xml){
		clearInterval(keepAliveTimer);
		if(err){
			response.write(err);
		}else{
			xml = xml.replace(xmlHeader, '');
			response.write(xml);
		}
		response.end();
	});
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
