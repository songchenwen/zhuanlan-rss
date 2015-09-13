var	request = require('request');
var parseJson = require('./apiJsonParser');

var requestTimeout = 15000;

var Api = function(id){
	this.id = id;
	this.url = 'http://zhuanlan.zhihu.com/api/columns/' + id + '/posts';
}

Api.prototype.get = function(cb) {
	request(this.url, 
		{timeout: requestTimeout}, 
		function(error, response, body){
			if(error){
				cb(error);
				return;
			}
			try{
				body = JSON.parse(body);
				var is = [];
				body.forEach(function(item){
					var i = parseJson(item)
					is.push(i);
				});
				cb(null, is);
			}catch(e){
				cb(e);
			}
		});
};

exports = module.exports = Api;
