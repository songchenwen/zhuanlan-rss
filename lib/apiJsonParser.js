
var Parser = function(json){
	return {
		title: json.title,
		description: json.content,
		url: json.url,
		guid: json.slug,
		author: json.author.name + (json.author.bio ? ' | ' + json.author.bio : ''),
		date: new Date(json.publishedTime),
		zhuanlan: json.column.slug
	};
}

exports = module.exports = Parser;
