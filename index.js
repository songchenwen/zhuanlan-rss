var ids = ['yeka52', 'maboyong', 'datouma', 'gaizhilizcw', 'tianhao', 'qinnan', 'lianghuan', 'talich', 
'loveletter', 'zenithdie', 'Glasschurch', 'nosensedigit', 'oldplusnew', 'negative2', 
'taosay', 'DKLearnsPop', 'mactalk', 'lswlsw', 'rosicky311', 'zhimovie', 'liangbianyao', 
'bianzhongqingnianxingdongzhinan', 'phos-study', 'wontfallinyourlap', '24frames', 'wuliang8910'];

var rss = require('./lib/rss');

var rssPath = __dirname + '/out/zhuanlanrss.xml';

var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.get('/', function(request, response) {
  rss(ids, rssPath, function(err){
  	if(err){
  		response.status(500).send(err);
  	}else{
  		response.status(200).sendFile(rssPath);
  	}
  });
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
  rss(ids, rssPath);
});
