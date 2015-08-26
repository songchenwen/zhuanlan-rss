var ids = ['yeka52', 'maboyong', 'datouma', 'gaizhilizcw', 'tianhao', 'qinnan', 'lianghuan', 'talich', 
'loveletter', 'zenithdie', 'Glasschurch', 'nosensedigit', 'oldplusnew', 'negative2', 
'taosay', 'DKLearnsPop', 'mactalk', 'lswlsw', 'rosicky311', 'zhimovie', 'liangbianyao', 
'bianzhongqingnianxingdongzhinan', 'phos-study', 'wontfallinyourlap', '24frames', 'wuliang8910'];

var rss = require('./lib/rss');
var fs = require('fs');
var express = require('express');
var app = express();

var rssPath = __dirname + '/out/zhuanlanrss.xml';


var lastUpdate = 0;
var cacheTime = 15 * 60 * 1000;

app.set('port', (process.env.PORT || 5000));

app.get('/', function(request, response) {
	if(fs.existsSync(rssPath)){
		if(new Date().getTime() - lastUpdate < cacheTime){
			console.log('response from cache');
			response.status(200).sendFile(rssPath);
			return;
		}else{
			console.log('cache expired');
		}
	}else{
		console.log('no cache file found');
	}
	console.log('begin request from zhihu');
  rss(ids, rssPath, function(err){
  	if(err){
  		lastUpdate = 0;
  		response.status(500).send(err);
  	}else{
  		lastUpdate = new Date().getTime();
  		response.status(200).sendFile(rssPath);
  	}
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
